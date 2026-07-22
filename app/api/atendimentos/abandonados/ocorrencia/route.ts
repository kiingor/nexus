import { NextRequest } from 'next/server'
import {
  getMensagensClient,
  listClientesByIds,
  listMensagensByCliente,
} from '@/lib/supabase/mensagens'

// Webhook do fluxo `abrir_ocorrencia_massa` no n8n.
const WEBHOOK =
  process.env.N8N_OCORRENCIA_MASSA_URL ??
  'https://n8n-webhook.mensageria.softcomtecnologia.com/webhook/criaroc-massa'

// Atendente fixo das ocorrências abertas por esta rotina.
const ATENDENTE = 'Claudio'
const SUPORTE_ID = 3127

// Trava de segurança: abrir ocorrência é irreversível do lado da Agenda.
const MAX_LOTE = 100

// A função tem 60s na Vercel; cortamos antes pra sobrar tempo de devolver
// uma mensagem em vez de morrer calada.
const TIMEOUT_MS = 50_000

// O fluxo do n8n leva alguns segundos por conversa (a IA resume cada uma).
export const maxDuration = 60

// A Agenda espera "yyyy-MM-dd HH:mm:ss" no fuso de Brasília.
function formatDataHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d)
  return partes.replace('T', ' ')
}

// Versão com fuso explícito, para gravar em coluna `timestamptz`.
//
// O formato acima é para a Agenda, mas mandá-lo ao Postgres grava errado:
// sem offset ele assume UTC e a hora fica 3h atrasada. Aqui o ISO original
// da mensagem já carrega o fuso, então é só repassar.
function toIso(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

/**
 * POST /api/atendimentos/abandonados/ocorrencia
 *
 * Abre ocorrência em massa para as conversas abandonadas selecionadas.
 * Monta o payload (transcrição + dados do cliente) e entrega ao n8n, que
 * gera motivo/serviço realizado por IA, abre e finaliza a ocorrência na
 * Agenda e cria o registro em `atendimentos`.
 *
 * Body: { clientes: [{ cliente_id, inicio, fim }] }
 */
export async function POST(request: NextRequest) {
  if (!getMensagensClient()) {
    return Response.json(
      { error: 'Banco de mensagens não configurado' },
      { status: 503 }
    )
  }

  let body: { clientes?: Array<{ cliente_id: string; inicio: string; fim: string }> }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const selecionados = (body.clientes ?? []).filter(
    (c) => c?.cliente_id && c?.inicio && c?.fim
  )

  if (selecionados.length === 0) {
    return Response.json({ error: 'Nenhuma conversa selecionada' }, { status: 400 })
  }
  if (selecionados.length > MAX_LOTE) {
    return Response.json(
      { error: `Máximo de ${MAX_LOTE} ocorrências por vez` },
      { status: 400 }
    )
  }

  try {
    const clientes = await listClientesByIds(selecionados.map((c) => c.cliente_id))

    const itens = []
    const semMensagens: string[] = []

    for (const sel of selecionados) {
      // Mesma folga usada no modal, pra não cortar a conversa na borda.
      const mensagens = await listMensagensByCliente(sel.cliente_id, {
        from: new Date(Date.parse(sel.inicio) - 60_000).toISOString(),
        to: new Date(Date.parse(sel.fim) + 60_000).toISOString(),
      })

      if (mensagens.length === 0) {
        semMensagens.push(sel.cliente_id)
        continue
      }

      // Formato "Cliente:/Cláudio:" — é o que o fluxo e a IA esperam.
      const transcricao = mensagens
        .map((m) => {
          const quem = m.remetente === 'cliente-nexus' ? 'Cliente' : 'Cláudio'
          const texto = m.conteudo ?? `[${m.media_type ?? 'anexo'}]`
          return `${quem}: ${texto}`
        })
        .join('\n')

      const cli = clientes.get(sel.cliente_id)

      // A chegada é a primeira fala do CLIENTE — é quando o atendimento
      // começou de fato. A primeira mensagem da conversa às vezes é do bot
      // (saudação automática), o que adiantaria a hora sem motivo.
      const primeiraDoCliente = mensagens.find(
        (m) => m.remetente === 'cliente-nexus' && m.enviado_em
      )
      const chegada = primeiraDoCliente?.enviado_em ?? sel.inicio

      // A saída é a última mensagem trocada, seja de quem for.
      const ultima = mensagens[mensagens.length - 1]?.enviado_em ?? sel.fim

      // Anexos enviados pelo cliente (comprovante de pagamento, print do
      // erro, PDF). Só os do cliente interessam — o que o bot manda não é
      // comprovante de nada. Limita a 3 pra não estourar o campo.
      const comprovantes = mensagens
        .filter((m) => m.remetente === 'cliente-nexus' && m.url_imagem)
        .map((m) => m.url_imagem as string)
        .slice(0, 3)

      itens.push({
        cliente_id: sel.cliente_id,
        transcricao_completa: transcricao,
        // Formato da Agenda (hora de Brasília, sem fuso).
        DataHoraChegada: formatDataHora(chegada),
        DataHoraSaida: formatDataHora(ultima),
        // Mesmos instantes em ISO, para as colunas timestamptz do Supabase.
        chegada_iso: toIso(chegada),
        saida_iso: toIso(ultima),
        PDV: cli?.PDV ?? '',
        cnpj: cli?.CNPJ ?? '',
        SolicitadoPor: cli?.nome ?? '',
        registro: '',
        id_chat: '',
        comprovante_url: comprovantes.join(' '),
        atendente: ATENDENTE,
        suporte_id: SUPORTE_ID,
      })
    }

    if (itens.length === 0) {
      return Response.json(
        { error: 'Nenhuma conversa com mensagens no período', semMensagens },
        { status: 400 }
      )
    }

    // Corta antes do teto da função na Vercel, senão a resposta morre sem
    // mensagem nenhuma e o operador fica sem saber o que aconteceu.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let r: Response
    try {
      r = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens }),
        signal: controller.signal,
      })
    } catch (e) {
      const abortou = e instanceof Error && e.name === 'AbortError'
      return Response.json(
        {
          error: abortou
            ? `O n8n não respondeu em ${Math.round(TIMEOUT_MS / 1000)}s. As ocorrências podem ter sido abertas assim mesmo — confira no n8n antes de tentar de novo.`
            : `Não foi possível falar com o n8n: ${e instanceof Error ? e.message : 'erro desconhecido'}`,
          enviados: itens.length,
          timeout: abortou,
        },
        { status: 504 }
      )
    } finally {
      clearTimeout(timer)
    }

    const texto = await r.text()
    let resultado: unknown
    try {
      resultado = JSON.parse(texto)
    } catch {
      resultado = texto
    }

    if (!r.ok) {
      return Response.json(
        {
          // O n8n devolve a mensagem do nó que quebrou; é ela que interessa
          // na tela, não o status genérico.
          error: `Falha no fluxo do n8n (HTTP ${r.status}): ${extrairMensagem(resultado) || 'sem detalhe'}`,
          detalhe: resultado,
        },
        { status: 502 }
      )
    }

    // O fluxo pode responder 200 e ainda assim ter falhado item a item.
    const falhas =
      resultado && typeof resultado === 'object' && 'falhas' in resultado
        ? Number((resultado as { falhas: unknown }).falhas)
        : 0

    return Response.json({
      enviados: itens.length,
      semMensagens,
      falhas: Number.isFinite(falhas) ? falhas : 0,
      resultado,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao abrir ocorrências'
    return Response.json({ error: msg }, { status: 502 })
  }
}

// O corpo de erro do n8n varia conforme onde quebrou: às vezes `message`,
// às vezes `error`, às vezes texto puro.
function extrairMensagem(corpo: unknown): string {
  if (typeof corpo === 'string') return corpo.slice(0, 400)
  if (corpo && typeof corpo === 'object') {
    const o = corpo as Record<string, unknown>
    for (const chave of ['message', 'error', 'description', 'hint']) {
      const v = o[chave]
      if (typeof v === 'string' && v.trim()) return v.slice(0, 400)
    }
    return JSON.stringify(corpo).slice(0, 400)
  }
  return ''
}
