import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { classifyMotivo, MOTIVO_CATEGORIES } from '@/lib/atendimentos'
import type { AtendimentoRecord } from '@/lib/types'

// Endpoint do Dashboard de Monitoramento de Atendimentos.
//
// Aceita os mesmos filtros temporais do /api/atendimentos (`from`, `to`,
// ISO strings) e retorna agregações prontas pra renderizar no front:
//
// {
//   kpi:        { total, resolvidos, transferidos, em_atendimento,
//                 interrompida, percentualResolucao },
//   byStatus:   [{ status, count }],
//   byDay:      [{ date, resolvidos, transferidos, outros }],
//   topMotivos: [{ motivo, count }],
//   worstMotivos: [{ motivo, total, resolvidos, transferidos, percentual }],
// }
//
// A agregação por motivo usa classifyMotivo (regex + categoria estruturada
// quando disponível) — mesma lógica do /simulate, mantendo buckets
// consistentes entre as duas telas.

// Tamanho do lote de cada SELECT no Supabase. 1000 é o limite default do
// PostgREST — usar exatamente esse valor por batch evita pedir nada além
// do que o servidor entrega sem custo extra de configuração.
const BATCH_SIZE = 1000

// Freio de segurança em caso de algum filtro vir muito largo ("Todo o
// período" sem mais nada). 500k registros das colunas que selecionamos
// dão ~50-80 MB em memória — confortável pra um endpoint Node. Acima
// disso, o response sinaliza `truncated: true` e o cliente avisa.
const MAX_TOTAL_ROWS = 500_000

type RowSubset = Pick<
  AtendimentoRecord,
  | 'id'
  | 'status'
  | 'criado_em'
  | 'data_hora_chegada'
  | 'problema_relatado'
  | 'transcricao'
  | 'problema_extraido'
>

export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  // Aceita os MESMOS filtros que a aba "Lista" tem, pra que o dashboard
  // mostre agregações sobre o EXATO conjunto que aparece na Lista.
  const destino = searchParams.get('destino')         // 'servicedesk' | 'financeiro' | 'comercial' | 'ouvidoria' | null
  const status = searchParams.get('status')           // status_filter (ex: 'resolvida_ia')
  const tipoContato = searchParams.get('tipo_contato') // 'ligacao' | 'chat'
  const sentimento = searchParams.get('sentimento')   // 'positivo' | 'neutro' | 'negativo'
  const soComProblema = searchParams.get('com_problema') === 'true'

  // Busca paginada em lotes — sem cap fixo na agregação. Continua até
  // esgotar (rows < BATCH_SIZE) ou bater o freio defensivo MAX_TOTAL_ROWS.
  // Os mesmos filtros são re-aplicados em cada batch.
  const SELECT_COLS =
    'id, status, criado_em, data_hora_chegada, problema_relatado, transcricao, problema_extraido'
  const rows: RowSubset[] = []
  let totalCount = 0
  let truncated = false
  let offset = 0
  while (true) {
    // O `count: 'exact'` só vale a pena no primeiro lote — o servidor
    // devolve o total respeitando os filtros, e os lotes seguintes não
    // precisam pagar pelo count.
    let q = supabase
      .from('atendimentos')
      .select(SELECT_COLS, offset === 0 ? { count: 'exact' } : {})
      .order('criado_em', { ascending: false, nullsFirst: false })
      .range(offset, offset + BATCH_SIZE - 1)

    if (from) q = q.gte('criado_em', from)
    if (to)   q = q.lt('criado_em', to)
    if (destino === 'servicedesk' || destino === 'financeiro' || destino === 'comercial' || destino === 'ouvidoria') q = q.eq('destino', destino)
    if (status && status !== 'all') q = q.eq('status', status)
    if (tipoContato === 'ligacao' || tipoContato === 'chat') q = q.eq('tipo_contato', tipoContato)
    if (soComProblema) q = q.eq('problema_extraido->>tem_problema_extraivel', 'true')
    if (sentimento === 'positivo') {
      q = q.or(
        [
          'sentimento_cliente.ilike.%positiv%',
          'sentimento_cliente.ilike.%satisfe%',
          'sentimento_cliente.ilike.%feliz%',
          'sentimento_cliente.ilike.%bom%',
          'sentimento_cliente.ilike.%ótimo%',
          'sentimento_cliente.ilike.%otimo%',
          'sentimento_cliente.ilike.%excelente%',
        ].join(',')
      )
    } else if (sentimento === 'negativo') {
      q = q.or(
        [
          'sentimento_cliente.ilike.%negativ%',
          'sentimento_cliente.ilike.%insatisfe%',
          'sentimento_cliente.ilike.%irrita%',
          'sentimento_cliente.ilike.%frustra%',
          'sentimento_cliente.ilike.%ruim%',
          'sentimento_cliente.ilike.%péssimo%',
          'sentimento_cliente.ilike.%pessimo%',
          'sentimento_cliente.ilike.%raiva%',
        ].join(',')
      )
    } else if (sentimento === 'neutro') {
      q = q.or(
        [
          'sentimento_cliente.ilike.%neutr%',
          'sentimento_cliente.ilike.%ok%',
          'sentimento_cliente.ilike.%indifer%',
        ].join(',')
      )
    }

    const { data, error, count } = await q
    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (offset === 0) totalCount = count ?? 0
    const batch = (data ?? []) as unknown as RowSubset[]
    rows.push(...batch)
    if (batch.length < BATCH_SIZE) break
    offset += BATCH_SIZE
    if (rows.length >= MAX_TOTAL_ROWS) {
      truncated = totalCount > rows.length
      break
    }
  }

  // ── KPI ────────────────────────────────────────────────────────────
  let resolvidos = 0, parcialmente = 0, transferidos = 0, emAtendimento = 0, interrompida = 0
  for (const r of rows) {
    if (r.status === 'resolvida_ia') resolvidos++
    else if (r.status === 'resolvido_parcialmente') parcialmente++
    else if (r.status === 'transferida') transferidos++
    else if (r.status === 'em_atendimento') emAtendimento++
    else if (r.status === 'interrompida') interrompida++
  }
  const total = rows.length
  // % Resolução: sobre FINALIZADOS, parcial NÃO conta como resolvido —
  // ainda foi transferida no fim das contas. Parcial é só uma anotação
  // do reviewer indicando que a IA ajudou em algo antes da transferência.
  const finalizados = resolvidos + parcialmente + transferidos
  const percentualResolucao =
    finalizados > 0 ? Math.round((resolvidos / finalizados) * 100) : 0

  // ── byStatus (5 buckets) ──────────────────────────────────────────
  const byStatus = [
    { status: 'resolvida_ia',           count: resolvidos },
    { status: 'resolvido_parcialmente', count: parcialmente },
    { status: 'transferida',            count: transferidos },
    { status: 'em_atendimento',         count: emAtendimento },
    { status: 'interrompida',           count: interrompida },
  ]

  // ── byDay (volume diário) ─────────────────────────────────────────
  // Agrupa por YYYY-MM-DD (UTC-3) — mesmo fuso usado nos filtros.
  const byDayMap = new Map<
    string,
    { date: string; resolvidos: number; parcialmente: number; transferidos: number; outros: number }
  >()
  for (const r of rows) {
    const iso = r.criado_em ?? r.data_hora_chegada
    if (!iso) continue
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) continue
    // Converte pra UTC-3 manualmente sem libs externas.
    const utcMs = d.getTime() + d.getTimezoneOffset() * 60_000
    const localDate = new Date(utcMs - 3 * 60 * 60 * 1000)
    const y = localDate.getUTCFullYear()
    const m = String(localDate.getUTCMonth() + 1).padStart(2, '0')
    const day = String(localDate.getUTCDate()).padStart(2, '0')
    const key = `${y}-${m}-${day}`

    const bucket =
      byDayMap.get(key) ??
      { date: key, resolvidos: 0, parcialmente: 0, transferidos: 0, outros: 0 }
    if (r.status === 'resolvida_ia') bucket.resolvidos++
    else if (r.status === 'resolvido_parcialmente') bucket.parcialmente++
    else if (r.status === 'transferida') bucket.transferidos++
    else bucket.outros++
    byDayMap.set(key, bucket)
  }
  const byDay = Array.from(byDayMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  )

  // ── topMotivos + worstMotivos ─────────────────────────────────────
  const motivoStats = new Map<
    string,
    { motivo: string; total: number; resolvidos: number; parcialmente: number; transferidos: number }
  >()
  // Inicializa todos os buckets com zero pra ordenação estável
  for (const cat of MOTIVO_CATEGORIES) {
    motivoStats.set(cat, { motivo: cat, total: 0, resolvidos: 0, parcialmente: 0, transferidos: 0 })
  }
  for (const r of rows) {
    const motivo = classifyMotivo({
      problema_relatado: r.problema_relatado,
      transcricao: r.transcricao,
      problema_extraido: r.problema_extraido as RowSubset['problema_extraido'],
    })
    const bucket = motivoStats.get(motivo)!
    bucket.total++
    if (r.status === 'resolvida_ia') bucket.resolvidos++
    else if (r.status === 'resolvido_parcialmente') bucket.parcialmente++
    else if (r.status === 'transferida') bucket.transferidos++
  }
  const motivoArr = Array.from(motivoStats.values()).filter((m) => m.total > 0)

  // Três cortes da mesma agregação de motivos, devolvendo TUDO (sem
  // slice). O front controla a paginação visual com "Mostrar mais".
  // Como há ~35 categorias canônicas, o payload nunca é grande mesmo
  // sem truncar.
  // - topMotivos: maior volume total
  // - mostResolvidos: maior número de resoluções pela IA
  // - mostTransferidos: maior número de transferências (gargalo da IA)
  const topMotivos = [...motivoArr]
    .sort((a, b) => b.total - a.total)
    .map(({ motivo, total }) => ({ motivo, count: total }))

  const mostResolvidos = [...motivoArr]
    .filter((m) => m.resolvidos > 0)
    .sort((a, b) => b.resolvidos - a.resolvidos)
    .map(({ motivo, resolvidos }) => ({ motivo, count: resolvidos }))

  const mostTransferidos = [...motivoArr]
    .filter((m) => m.transferidos > 0)
    .sort((a, b) => b.transferidos - a.transferidos)
    .map(({ motivo, transferidos }) => ({ motivo, count: transferidos }))

  // Worst = motivos com pior % resolução (entre os que TÊM finalizados).
  // Mostra só motivos com pelo menos 3 finalizados pra evitar
  // "categoria com 1 atendimento" liderando o ranking de pior.
  // Devolve TODOS qualificados; front controla "Mostrar mais".
  const worstMotivos = motivoArr
    .map((m) => {
      // Parcial entra no denominador (foi finalizado) mas NÃO no numerador
      // — coerente com a fórmula global do KPI.
      const fin = m.resolvidos + m.parcialmente + m.transferidos
      const pct = fin > 0 ? Math.round((m.resolvidos / fin) * 100) : null
      return { ...m, finalizados: fin, percentual: pct }
    })
    .filter((m) => m.finalizados >= 3 && m.percentual !== null)
    .sort((a, b) => (a.percentual ?? 100) - (b.percentual ?? 100))

  return Response.json({
    kpi: {
      total,
      resolvidos,
      parcialmente,
      transferidos,
      em_atendimento: emAtendimento,
      interrompida,
      percentualResolucao,
    },
    byStatus,
    byDay,
    topMotivos,
    mostResolvidos,
    mostTransferidos,
    worstMotivos,
    truncated,
  })
}
