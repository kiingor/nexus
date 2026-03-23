import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createServerClient()
  const { searchParams } = new URL(request.url)
  const moduleId = searchParams.get('moduleId')

  // Get product
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!product) {
    return Response.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  let query = supabase
    .from('knowledge_items')
    .select('*, modules!inner(product_id)')
    .eq('modules.product_id', product.id)
    .order('created_at', { ascending: true })

  if (moduleId) {
    query = query.eq('module_id', moduleId)
  }

  const { data, error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data || [])
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  await params // validate route
  const supabase = createServerClient()
  const body = await request.json()

  // Validate module_id exists
  if (!body.module_id) {
    return Response.json({ error: 'module_id é obrigatório' }, { status: 400 })
  }

  const { data: moduleExists } = await supabase
    .from('modules')
    .select('id')
    .eq('id', body.module_id)
    .single()

  if (!moduleExists) {
    return Response.json({ error: `Módulo ${body.module_id} não encontrado` }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('knowledge_items')
    .insert({
      module_id: body.module_id,
      title: body.title,
      type: body.type,
      content: body.content,
      keywords: body.keywords || [],
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
