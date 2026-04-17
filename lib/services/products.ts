import { createServerClient } from '@/lib/supabase/server'

export interface ProductSummary {
  id: string
  name: string
  slug: string
  description: string | null
  module_count: number
  item_count: number
}

export async function listProducts(): Promise<ProductSummary[]> {
  const supabase = createServerClient()

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, slug, description')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const enriched = await Promise.all(
    (products || []).map(async (p) => {
      const { count: moduleCount } = await supabase
        .from('modules')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', p.id)

      const { count: itemCount } = await supabase
        .from('knowledge_items')
        .select('*, modules!inner(product_id)', { count: 'exact', head: true })
        .eq('modules.product_id', p.id)

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        module_count: moduleCount || 0,
        item_count: itemCount || 0,
      }
    })
  )

  return enriched
}
