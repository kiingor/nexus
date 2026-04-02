import { NextRequest } from 'next/server'
import { syncItemEmbeddings, deleteItemEmbeddings } from '@/lib/embeddings'

/**
 * POST /api/embeddings/sync
 * Body: { item_id: string, action: 'upsert' | 'delete' }
 *
 * Gera ou remove embeddings para um knowledge item.
 * Chamado automaticamente após criar/editar/apagar itens.
 */
export async function POST(request: NextRequest) {
  try {
    const { item_id, action } = await request.json()

    if (!item_id || !action) {
      return Response.json({ error: 'item_id and action are required' }, { status: 400 })
    }

    if (action === 'delete') {
      await deleteItemEmbeddings(item_id)
    } else {
      await syncItemEmbeddings(item_id)
    }

    return Response.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[embeddings/sync]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
