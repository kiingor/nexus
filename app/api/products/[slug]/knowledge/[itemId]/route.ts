import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { syncItemEmbeddings, deleteItemEmbeddings } from '@/lib/embeddings'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; itemId: string }> }
) {
  const { itemId } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('id', itemId)
    .single()

  if (error || !data) {
    return Response.json({ error: 'Item não encontrado' }, { status: 404 })
  }

  return Response.json(data)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; itemId: string }> }
) {
  const { itemId } = await params
  const supabase = createServerClient()
  const body = await request.json()

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.title !== undefined) updateData.title = body.title
  if (body.content !== undefined) updateData.content = body.content
  if (body.keywords !== undefined) updateData.keywords = body.keywords
  if (body.is_active !== undefined) updateData.is_active = body.is_active
  if (body.module_id !== undefined) updateData.module_id = body.module_id

  const { data, error } = await supabase
    .from('knowledge_items')
    .update(updateData)
    .eq('id', itemId)
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Regerar embeddings com conteúdo atualizado
  syncItemEmbeddings(itemId).catch(console.error)

  return Response.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; itemId: string }> }
) {
  const { itemId } = await params
  const supabase = createServerClient()

  // Apagar embeddings primeiro (antes de apagar o item)
  await deleteItemEmbeddings(itemId)

  const { error } = await supabase
    .from('knowledge_items')
    .delete()
    .eq('id', itemId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
