import { NextRequest } from 'next/server'
import { syncExampleEmbedding } from '@/lib/embeddings'

/**
 * POST /api/knowledge-items/[id]/examples
 *
 * Vincula uma mensagem real do cliente ao cenário (knowledge_item).
 * Internamente: gera embedding e insere chunk em knowledge_embeddings
 * com chunk_type='client_example'. O agente n8n passa a encontrar o
 * cenário quando uma mensagem similar chegar — sem mudanças no fluxo.
 *
 * Body:
 * {
 *   messageText: string,         // obrigatório
 *   sourceAtendimentoId?: number,
 *   sourceMessageIndex?: number,
 *   sourceSpeaker?: string,
 *   createdBy?: string           // email do reviewer
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const messageText = typeof body.messageText === 'string' ? body.messageText.trim() : ''
  if (!messageText) {
    return Response.json({ error: 'messageText obrigatório' }, { status: 400 })
  }

  try {
    const result = await syncExampleEmbedding({
      itemId: id,
      messageText,
      sourceAtendimentoId: toNumOrNull(body.sourceAtendimentoId),
      sourceMessageIndex: toNumOrNull(body.sourceMessageIndex),
      sourceSpeaker: typeof body.sourceSpeaker === 'string' ? body.sourceSpeaker : null,
      createdBy: typeof body.createdBy === 'string' ? body.createdBy : null,
    })
    return Response.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro inesperado'
    return Response.json({ error: message }, { status: 500 })
  }
}

function toNumOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}
