import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !data) {
    return Response.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  return Response.json(data)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createServerClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('products')
    .update({
      name: body.name,
      slug: body.slug,
      description: body.description || null,
    })
    .eq('slug', slug)
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createServerClient()

  // Get product ID first
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!product) {
    return Response.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  // Delete knowledge items for all modules of this product
  const { data: modules } = await supabase
    .from('modules')
    .select('id')
    .eq('product_id', product.id)

  if (modules && modules.length > 0) {
    const moduleIds = modules.map((m) => m.id)
    await supabase.from('knowledge_items').delete().in('module_id', moduleIds)
  }

  // Delete modules
  await supabase.from('modules').delete().eq('product_id', product.id)

  // Delete product
  const { error } = await supabase.from('products').delete().eq('id', product.id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
