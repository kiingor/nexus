import { createServerClient } from '@/lib/supabase/server'

export interface ModuleSummary {
  id: string
  name: string
  type: 'instruction' | 'error'
  description: string | null
  keywords: string[]
  item_count: number
}

export async function listModulesByProductSlug(
  productSlug: string
): Promise<ModuleSummary[]> {
  const supabase = createServerClient()

  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', productSlug)
    .single()

  if (!product) {
    throw new Error(`Produto não encontrado: ${productSlug}`)
  }

  const { data: modules, error } = await supabase
    .from('modules')
    .select('id, name, type, description, keywords')
    .eq('product_id', product.id)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  const enriched = await Promise.all(
    (modules || []).map(async (m) => {
      const { count } = await supabase
        .from('knowledge_items')
        .select('*', { count: 'exact', head: true })
        .eq('module_id', m.id)

      return {
        id: m.id,
        name: m.name,
        type: m.type as 'instruction' | 'error',
        description: m.description,
        keywords: m.keywords || [],
        item_count: count || 0,
      }
    })
  )

  return enriched
}
