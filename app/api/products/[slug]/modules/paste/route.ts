import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { syncItemEmbeddings } from '@/lib/embeddings'

export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createServerClient()
  const body = await request.json()

  // Get target product
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!product) {
    return Response.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  const modulesToPaste = body.modules as Array<{
    name: string
    type: 'instruction' | 'error'
    description: string | null
    keywords: string[]
    knowledgeItems: Array<{
      title: string
      type: 'instruction' | 'error'
      content: Record<string, unknown>
      keywords: string[]
      is_active: boolean
    }>
  }>

  if (!Array.isArray(modulesToPaste) || modulesToPaste.length === 0) {
    return Response.json({ error: 'Nenhum módulo para colar' }, { status: 400 })
  }

  const createdModules: string[] = []
  const createdItemIds: string[] = []

  for (const mod of modulesToPaste) {
    // Check for existing module with same name
    const { data: existingModules } = await supabase
      .from('modules')
      .select('id')
      .eq('product_id', product.id)
      .eq('name', mod.name)

    // Delete existing module and its items if name conflict
    if (existingModules && existingModules.length > 0) {
      for (const existing of existingModules) {
        // Delete embeddings
        const { data: items } = await supabase
          .from('knowledge_items')
          .select('id')
          .eq('module_id', existing.id)
        if (items?.length) {
          await supabase
            .from('knowledge_embeddings')
            .delete()
            .in('item_id', items.map(i => i.id))
        }
        // Delete knowledge items
        await supabase.from('knowledge_items').delete().eq('module_id', existing.id)
        // Delete module
        await supabase.from('modules').delete().eq('id', existing.id)
      }
    }

    // Create new module
    const { data: newModule, error: moduleError } = await supabase
      .from('modules')
      .insert({
        product_id: product.id,
        name: mod.name,
        type: mod.type,
        description: mod.description,
        keywords: mod.keywords || [],
      })
      .select()
      .single()

    if (moduleError || !newModule) {
      return Response.json({ error: `Erro ao criar módulo "${mod.name}": ${moduleError?.message}` }, { status: 500 })
    }

    // Create knowledge items
    for (const item of mod.knowledgeItems) {
      const { data: newItem, error: itemError } = await supabase
        .from('knowledge_items')
        .insert({
          module_id: newModule.id,
          title: item.title,
          type: item.type,
          content: item.content,
          keywords: item.keywords || [],
          is_active: item.is_active ?? true,
        })
        .select()
        .single()

      if (itemError) {
        console.error(`Erro ao criar item "${item.title}":`, itemError.message)
        continue
      }

      if (newItem) {
        createdItemIds.push(newItem.id)
      }
    }

    createdModules.push(mod.name)
  }

  const embeddingFailures: Array<{ item_id: string; error: string }> = []
  const concurrency = 3

  for (let index = 0; index < createdItemIds.length; index += concurrency) {
    const batch = createdItemIds.slice(index, index + concurrency)
    const results = await Promise.allSettled(batch.map(itemId => syncItemEmbeddings(itemId)))
    results.forEach((result, resultIndex) => {
      if (result.status === 'rejected') {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason)
        embeddingFailures.push({ item_id: batch[resultIndex], error: reason })
      }
    })
  }

  if (embeddingFailures.length > 0) {
    console.error('[modules/paste] embedding sync failures:', embeddingFailures)
    return Response.json({
      error: 'Módulos criados, mas alguns itens não foram indexados.',
      created: createdModules.length,
      modules: createdModules,
      embedding_failures: embeddingFailures,
    }, { status: 502 })
  }

  return Response.json({
    success: true,
    created: createdModules.length,
    modules: createdModules,
    indexed_items: createdItemIds.length,
  })
}
