import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  getMensagensClient,
  listClientesByIds,
  listMensagensNoPeriodo,
  onlyDigits,
} from '@/lib/supabase/mensagens'

// Tempo sem mensagem nova para considerar a conversa parada.
const OCIOSO_MS = 60 * 60 * 1000

// Folga na busca de atendimentos: a conversa pode ter começado um pouco
// antes da janela e o registro sair depois dela.
const FOLGA_MS = 2 * 60 * 60 * 1000

// O registro em `atendimentos` é gravado logo após a última mensagem;
// aceita alguns minutos de diferença pro início da conversa.
const MARGEM_MS = 5 * 60 * 1000

export type AtendimentoAbandonado = {
  cliente_id: string
  nome: string
  telefone: string | null
  cnpj: string | null
  pdv: string | null
  inicio: string
  fim: string
  total: number
  parado_minutos: number
}

// Telefone casa pelos últimos 8 dígitos: os formatos divergem entre os dois
// bancos (+55, 9º dígito), mas o final é estável.
const tail8 = (v: string | null | undefined) => onlyDigits(v).slice(-8)

/**
 * GET /api/atendimentos/abandonados?from=ISO&to=ISO
 *
 * Conversas do fluxo Nexus (banco de mensagens) que estão paradas há mais
 * de 1 hora e NÃO têm registro em `atendimentos` — ou seja, o cliente parou
 * de responder antes de confirmar, então a IA não fechou como resolvido nem
 * transferiu. É o buraco entre os dois bancos.
 */
export async function GET(request: NextRequest) {
  if (!getMensagensClient()) {
    return Response.json(
      { error: 'Banco de mensagens não configurado', abandonados: [] },
      { status: 503 }
    )
  }

  const sp = request.nextUrl.searchParams
  const agora = Date.now()

  const to = sp.get('to') ?? new Date(agora).toISOString()
  const from =
    sp.get('from') ?? new Date(agora - 24 * 60 * 60 * 1000).toISOString()

  const fromMs = Date.parse(from)
  const toMs = Date.parse(to)
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return Response.json({ error: 'Período inválido' }, { status: 400 })
  }

  try {
    // 1. Todas as mensagens do período, agrupadas por cliente.
    const { rows, truncated } = await listMensagensNoPeriodo(from, to)

    type Conversa = { inicio: number; fim: number; total: number }
    const porCliente = new Map<string, Conversa>()

    for (const m of rows) {
      const t = Date.parse(m.enviado_em)
      if (!Number.isFinite(t)) continue
      const atual = porCliente.get(m.cliente_id)
      if (!atual) {
        porCliente.set(m.cliente_id, { inicio: t, fim: t, total: 1 })
        continue
      }
      atual.inicio = Math.min(atual.inicio, t)
      atual.fim = Math.max(atual.fim, t)
      atual.total++
    }

    // 2. Só as paradas há mais de 1h.
    const corte = agora - OCIOSO_MS
    const parados = [...porCliente.entries()].filter(
      ([, c]) => c.fim <= corte
    )

    // 3. Atendimentos registrados no período (com folga nas duas pontas).
    //
    // Em lotes de 1000: o PostgREST corta a resposta nesse teto e um
    // `.limit()` maior NÃO vence — sem paginar, períodos longos trariam só
    // parte dos atendimentos e tudo mais pareceria abandonado.
    const supabase = createServerClient()
    const atendimentos: Array<{ criado_em: string; phone: string | null; cnpj: string | null }> = []
    const PAGINA = 1000
    const MAX_ATENDIMENTOS = 100_000

    for (let offset = 0; offset < MAX_ATENDIMENTOS; offset += PAGINA) {
      const { data, error } = await supabase
        .from('atendimentos')
        .select('phone, cnpj, criado_em')
        .gte('criado_em', new Date(fromMs - FOLGA_MS).toISOString())
        .lte('criado_em', new Date(toMs + FOLGA_MS).toISOString())
        .order('criado_em', { ascending: true })
        .range(offset, offset + PAGINA - 1)

      if (error) return Response.json({ error: error.message }, { status: 500 })

      const lote = data ?? []
      atendimentos.push(...lote)
      if (lote.length < PAGINA) break
    }

    const porTelefone = new Map<string, number[]>()
    const porCnpj = new Map<string, number[]>()
    for (const a of atendimentos) {
      const criado = Date.parse(a.criado_em)
      if (!Number.isFinite(criado)) continue

      const t = tail8(a.phone)
      if (t.length === 8) {
        const lista = porTelefone.get(t)
        if (lista) lista.push(criado)
        else porTelefone.set(t, [criado])
      }

      const c = onlyDigits(a.cnpj)
      if (c) {
        const lista = porCnpj.get(c)
        if (lista) lista.push(criado)
        else porCnpj.set(c, [criado])
      }
    }

    // 4. Cadastro dos clientes das conversas paradas.
    const clientes = await listClientesByIds(parados.map(([id]) => id))

    // 5. Conversa sem nenhum atendimento criado a partir do seu início.
    const abandonados: AtendimentoAbandonado[] = []
    for (const [clienteId, conv] of parados) {
      const cli = clientes.get(clienteId)
      const candidatos = [
        ...(porTelefone.get(tail8(cli?.telefone)) ?? []),
        ...(porCnpj.get(onlyDigits(cli?.CNPJ)) ?? []),
      ]
      if (candidatos.some((criado) => criado >= conv.inicio - MARGEM_MS)) {
        continue
      }

      abandonados.push({
        cliente_id: clienteId,
        nome: cli?.nome ?? '(cliente não identificado)',
        telefone: cli?.telefone ?? null,
        cnpj: cli?.CNPJ ?? null,
        pdv: cli?.PDV ?? null,
        inicio: new Date(conv.inicio).toISOString(),
        fim: new Date(conv.fim).toISOString(),
        total: conv.total,
        parado_minutos: Math.round((agora - conv.fim) / 60000),
      })
    }

    abandonados.sort((a, b) => Date.parse(b.fim) - Date.parse(a.fim))

    return Response.json({
      abandonados,
      stats: {
        conversas: porCliente.size,
        parados: parados.length,
        atendimentos: atendimentos.length,
        abandonados: abandonados.length,
      },
      periodo: { from, to },
      truncated,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao buscar abandonados'
    return Response.json({ error: msg, abandonados: [] }, { status: 502 })
  }
}
