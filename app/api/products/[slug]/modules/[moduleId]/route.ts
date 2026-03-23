import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; moduleId: string }> }
) {
  const { moduleId } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('modules')
    .select('*')
    .eq('id', moduleId)
    .single()

  if (error || !data) {
    return Response.json({ error: 'Módulo não encontrado' }, { status: 404 })
  }

  return Response.json(data)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; moduleId: string }> }
) {
  const { moduleId } = await params
  const supabase = createServerClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('modules')
    .update({
      name: body.name,
      type: body.type,
      description: body.description || null,
      keywords: body.keywords || [],
    })
    .eq('id', moduleId)
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; moduleId: string }> }
) {
  const { moduleId } = await params
  const supabase = createServerClient()

  // Delete all knowledge items in this module
  await supabase.from('knowledge_items').delete().eq('module_id', moduleId)

  // Delete module
  const { error } = await supabase.from('modules').delete().eq('id', moduleId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
