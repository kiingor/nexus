import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/atendimentos/[id]/examples
 *
 * Lista as mensagens deste atendimento que já foram vinculadas a algum
 * cenário (knowledge_item). Usado pela seção "Mensagens vinculadas a
 * cenários" no modal de detalhes.
 *
 * Retorna chunks de knowledge_embeddings com source_atendimento_id = id
 * (chunk_type='client_example'), expandindo com info do item alvo.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const atendimentoId = Number(id)
  if (!Number.isFinite(atendimentoId)) {
    return Response.json({ error: 'id inválido' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('knowledge_embeddings')
    .select(
      'id, chunk_text, source_message_index, source_speaker, created_by, created_at, item_id, knowledge_items(id, title, module_id, modules(id, name, products(id, name, slug)))'
    )
    .eq('source_atendimento_id', atendimentoId)
    .eq('chunk_type', 'client_example')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ examples: data ?? [] })
}
