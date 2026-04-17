import { createServerClient } from '@/lib/supabase/server'
import { syncItemEmbeddings } from '@/lib/embeddings'
import type { InstructionContent, ErrorContent, KnowledgeItem } from '@/lib/types'

export interface CreateKnowledgeItemParams {
  productSlug: string
  moduleId: string
  title: string
  type: 'instruction' | 'error'
  content: InstructionContent | ErrorContent
  keywords?: string[]
}

/**
 * Creates a knowledge item and triggers embedding sync in background.
 * Validates that productSlug and moduleId match (module must belong to product).
 */
export async function createKnowledgeItem(
  params: CreateKnowledgeItemParams
): Promise<KnowledgeItem> {
  const supabase = createServerClient()

  // Resolve product
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', params.productSlug)
    .single()

  if (!product) {
    throw new Error(`Produto não encontrado: ${params.productSlug}`)
  }

  // Verify module belongs to product
  const { data: mod } = await supabase
    .from('modules')
    .select('id, product_id')
    .eq('id', params.moduleId)
    .single()

  if (!mod) {
    throw new Error(`Módulo não encontrado: ${params.moduleId}`)
  }

  if (mod.product_id !== product.id) {
    throw new Error('Módulo não pertence ao produto informado')
  }

  const { data, error } = await supabase
    .from('knowledge_items')
    .insert({
      module_id: params.moduleId,
      title: params.title,
      type: params.type,
      content: params.content,
      keywords: params.keywords || [],
      is_active: true,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Fire-and-forget embedding sync
  syncItemEmbeddings(data.id).catch((err) =>
    console.error('[knowledge-items] embedding sync failed:', err)
  )

  return data as KnowledgeItem
}
