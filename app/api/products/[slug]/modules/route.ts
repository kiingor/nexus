import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createServerClient()

  // Get product
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!product) {
    return Response.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  const { data: modules, error } = await supabase
    .from('modules')
    .select('*')
    .eq('product_id', product.id)
    .order('created_at', { ascending: true })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Get item counts
  const modulesWithCounts = await Promise.all(
    (modules || []).map(async (mod) => {
      const { count } = await supabase
        .from('knowledge_items')
        .select('*', { count: 'exact', head: true })
        .eq('module_id', mod.id)

      return { ...mod, item_count: count || 0 }
    })
  )

  return Response.json(modulesWithCounts)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createServerClient()
  const body = await request.json()

  // Get product
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!product) {
    return Response.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('modules')
    .insert({
      product_id: product.id,
      name: body.name,
      type: body.type,
      description: body.description || null,
      keywords: body.keywords || [],
    })
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
