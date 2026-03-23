import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { validateApiKey, unauthorizedResponse } from '@/lib/auth/api'

export async function GET(request: NextRequest) {
  const supabase = createServerClient()

  // Allow both API key and session-based auth
  const isApiAuth = validateApiKey(request)
  if (!isApiAuth) {
    // For browser requests, we'll allow them through (middleware handles session)
  }

  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Get counts for each product
  const productsWithCounts = await Promise.all(
    (products || []).map(async (product) => {
      const { count: moduleCount } = await supabase
        .from('modules')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', product.id)

      const { count: itemCount } = await supabase
        .from('knowledge_items')
        .select('*, modules!inner(product_id)', { count: 'exact', head: true })
        .eq('modules.product_id', product.id)

      return {
        ...product,
        module_count: moduleCount || 0,
        item_count: itemCount || 0,
      }
    })
  )

  return Response.json(productsWithCounts)
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('products')
    .insert({
      name: body.name,
      slug: body.slug,
      description: body.description || null,
    })
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
