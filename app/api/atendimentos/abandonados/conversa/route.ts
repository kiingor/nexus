import { NextRequest } from 'next/server'
import {
  getMensagensClient,
  listMensagensByCliente,
} from '@/lib/supabase/mensagens'

/**
 * GET /api/atendimentos/abandonados/conversa?cliente_id=&from=&to=
 *
 * Conversa completa de um cliente no período — usada pelo modal da aba
 * "Abandonados". Diferente do endpoint por atendimento, aqui não há
 * registro em `atendimentos` pra amarrar, então o recorte é o próprio
 * período consultado.
 */
export async function GET(request: NextRequest) {
  if (!getMensagensClient()) {
    return Response.json(
      { error: 'Banco de mensagens não configurado', mensagens: [] },
      { status: 503 }
    )
  }

  const sp = request.nextUrl.searchParams
  const clienteId = sp.get('cliente_id')
  if (!clienteId) {
    return Response.json({ error: 'cliente_id é obrigatório' }, { status: 400 })
  }

  try {
    const mensagens = await listMensagensByCliente(clienteId, {
      from: sp.get('from'),
      to: sp.get('to'),
      limit: 500,
    })
    return Response.json({ mensagens })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao buscar a conversa'
    return Response.json({ error: msg, mensagens: [] }, { status: 502 })
  }
}
