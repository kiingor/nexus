import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * DELETE /api/knowledge-embeddings/[id]
 *
 * Remove um chunk individual de knowledge_embeddings. Usado pelo modal
 * de detalhes pra desvincular uma mensagem do cenário.
 *
 * Por segurança, só permite remover chunks do tipo 'client_example' —
 * chunks 'item_full', 'step', 'error_full' são gerados pelo pipeline
 * automático e só devem ser removidos via syncItemEmbeddings.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServerClient()

  // Confirma que é um client_example antes de deletar
  const { data: existing } = await supabase
    .from('knowledge_embeddings')
    .select('id, chunk_type')
    .eq('id', id)
    .maybeSingle()

  if (!existing) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }
  if (existing.chunk_type !== 'client_example') {
    return Response.json(
      { error: 'Este endpoint só remove client_example. Use syncItemEmbeddings pra os demais.' },
      { status: 403 }
    )
  }

  const { error } = await supabase
    .from('knowledge_embeddings')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
