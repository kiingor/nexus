import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  findClienteId,
  getMensagensClient,
  listEncerramentosTicket,
  listMensagensByCliente,
  type Mensagem,
} from '@/lib/supabase/mensagens'

// Margem em volta da janela do atendimento: o registro em `atendimentos` é
// gravado pelo n8n com pequeno atraso em relação às mensagens.
const MARGEM_MS = 5 * 60 * 1000

// Nos atendimentos de chat, `data_hora_chegada`/`data_hora_saida` vêm nulos
// e o `criado_em` marca o FIM da conversa (o n8n grava o registro quando o
// atendimento encerra). Então varremos para trás a partir dele.
const JANELA_PADRAO_MS = 12 * 60 * 60 * 1000

// Dentro dessa janela ampla, a conversa do atendimento é o último bloco
// contíguo de mensagens: um silêncio maior que isso separa atendimentos
// diferentes do mesmo cliente.
const GAP_SESSAO_MS = 30 * 60 * 1000

// Recorta o último bloco contíguo (mensagens já em ordem cronológica).
// Duas coisas quebram o bloco, o que vier primeiro:
//  - encerramento de ticket entre duas mensagens (a partir daí o cliente
//    volta ao estado "Sem ticket" e começa outro atendimento);
//  - silêncio maior que GAP_SESSAO_MS.
function ultimaSessao<T extends { enviado_em: string | null }>(
  msgs: T[],
  encerramentos: number[] = []
): T[] {
  let inicio = 0
  for (let i = 1; i < msgs.length; i++) {
    const anterior = Date.parse(msgs[i - 1].enviado_em ?? '')
    const atual = Date.parse(msgs[i].enviado_em ?? '')
    if (!Number.isFinite(anterior) || !Number.isFinite(atual)) continue

    const encerrouNoMeio = encerramentos.some(
      (t) => t > anterior && t <= atual
    )
    if (encerrouNoMeio || atual - anterior > GAP_SESSAO_MS) inicio = i
  }
  return msgs.slice(inicio)
}

/**
 * GET /api/atendimentos/[id]/mensagens
 *
 * Conversa do atendimento vinda do banco SECUNDÁRIO (public.mensagens),
 * filtrada em `remetente in ('cliente-nexus','bot-nexus')` — os demais
 * remetentes são de atendimento humano/outros canais e não fazem parte da
 * conversa da IA.
 *
 * O vínculo é por cliente (telefone/CNPJ), recortado pela janela de tempo
 * do atendimento. `?janela=off` traz a conversa inteira do cliente.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!getMensagensClient()) {
    return Response.json(
      { error: 'Banco de mensagens não configurado', mensagens: [] },
      { status: 503 }
    )
  }

  const supabase = createServerClient()
  const { data: atendimento, error } = await supabase
    .from('atendimentos')
    .select('id, phone, cnpj, data_hora_chegada, data_hora_saida, criado_em')
    .eq('id', id)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!atendimento) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const semJanela = request.nextUrl.searchParams.get('janela') === 'off'

  try {
    const clienteId = await findClienteId({
      phone: atendimento.phone,
      cnpj: atendimento.cnpj,
    })

    if (!clienteId) {
      return Response.json({
        mensagens: [],
        cliente_id: null,
        motivo: 'cliente_nao_encontrado',
      })
    }

    // Referência de tempo: fim do atendimento. Em ligação vem de
    // data_hora_saida; em chat, `criado_em` é o instante do encerramento.
    const fimMs = Date.parse(
      atendimento.data_hora_saida ?? atendimento.criado_em ?? ''
    )
    const chegadaMs = Date.parse(atendimento.data_hora_chegada ?? '')

    let from: string | null = null
    let to: string | null = null

    if (!semJanela && Number.isFinite(fimMs)) {
      const inicioMs = Number.isFinite(chegadaMs)
        ? chegadaMs
        : fimMs - JANELA_PADRAO_MS
      from = new Date(inicioMs - MARGEM_MS).toISOString()
      to = new Date(fimMs + MARGEM_MS).toISOString()
    }

    let mensagens: Mensagem[] = await listMensagensByCliente(clienteId, {
      from,
      to,
    })

    // Sem data de chegada, a janela é só um teto grosseiro — o recorte real
    // é o último bloco contíguo de mensagens.
    if (mensagens.length > 0 && !semJanela && !Number.isFinite(chegadaMs)) {
      const encerramentos = await listEncerramentosTicket(clienteId, {
        from,
        to,
      })
      mensagens = ultimaSessao(mensagens, encerramentos)
    }

    // Parte das mensagens do fluxo Nexus tem ticket_id; se a janela não
    // pegou nada, tenta pelos tickets tocados no período antes de desistir.
    let fallback: string | null = null
    if (mensagens.length === 0 && !semJanela) {
      const todas = await listMensagensByCliente(clienteId, {})
      if (todas.length > 0) {
        mensagens = todas
        fallback = 'janela_vazia'
      }
    }

    return Response.json({
      mensagens,
      cliente_id: clienteId,
      janela: from && to ? { from, to } : null,
      fallback,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao buscar mensagens'
    return Response.json({ error: msg, mensagens: [] }, { status: 502 })
  }
}
