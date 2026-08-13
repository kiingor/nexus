import { NextRequest } from 'next/server'
import { dedupeConsecutiveTransfers } from '@/lib/atendimento-dedup'
import { createServerClient } from '@/lib/supabase/server'
import type { AtendimentoRecord } from '@/lib/types'

const BATCH_SIZE = 1000
const MAX_TOTAL_ROWS = 500_000

type DedupeRow = Pick<
  AtendimentoRecord,
  | 'id'
  | 'status'
  | 'criado_em'
  | 'data_hora_chegada'
  | 'hub_cliente_id'
  | 'cnpj'
  | 'phone'
  | 'whatsapp_contato'
>

type FilterableQuery<T> = {
  eq: (column: string, value: unknown) => T
  or: (filters: string) => T
}

function applyNonStatusFilters<T extends FilterableQuery<T>>(
  query: T,
  searchParams: URLSearchParams
): T {
  const destino = searchParams.get('destino')
  const cnpj = searchParams.get('cnpj')
  const phone = searchParams.get('phone')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const soComProblema = searchParams.get('com_problema') === 'true'
  const soValidados = searchParams.get('validados') === 'true'
  const search = (searchParams.get('search') || '').trim()
  const sentimento = searchParams.get('sentimento')
  const tipoContato = searchParams.get('tipo_contato')
  const pdv = searchParams.get('pdv')
  const tipoAtendimento = searchParams.get('tipo_atendimento')

  if (destino) query = query.eq('destino', destino)
  if (cnpj) query = query.eq('cnpj', cnpj)
  if (phone) query = query.eq('phone', phone)

  if (from && to) {
    query = query.or(
      `and(data_hora_chegada.gte.${from},data_hora_chegada.lte.${to}),` +
        `and(data_hora_chegada.is.null,criado_em.gte.${from},criado_em.lte.${to})`
    )
  } else if (from) {
    query = query.or(
      `data_hora_chegada.gte.${from},and(data_hora_chegada.is.null,criado_em.gte.${from})`
    )
  } else if (to) {
    query = query.or(
      `data_hora_chegada.lte.${to},and(data_hora_chegada.is.null,criado_em.lte.${to})`
    )
  }

  if (soComProblema) {
    query = query.eq('problema_extraido->>tem_problema_extraivel', 'true')
  }
  if (soValidados) {
    query = query.or('validado.eq.true,validacao_transf.not.is.null')
  }
  if (tipoContato === 'ligacao' || tipoContato === 'chat') {
    query = query.eq('tipo_contato', tipoContato)
  }
  if (pdv) query = query.eq('pdv', pdv)
  if (tipoAtendimento) query = query.eq('tipo_atendimento', tipoAtendimento)

  if (search) {
    const escaped = search.replace(/[%_]/g, '\\$&')
    const pattern = `%${escaped}%`
    const parts = [
      `nome_empresa.ilike.${pattern}`,
      `cnpj.ilike.${pattern}`,
      `phone.ilike.${pattern}`,
      `cliente_nome.ilike.${pattern}`,
      `problema_relatado.ilike.${pattern}`,
      `id_ligacao.ilike.${pattern}`,
      `validacao_transf.ilike.${pattern}`,
      `validacao_comentario.ilike.${pattern}`,
    ]
    if (/^\d+$/.test(search)) parts.push(`id.eq.${search}`)
    query = query.or(parts.join(','))
  }

  if (sentimento === 'positivo') {
    query = query.or(
      'sentimento_cliente.ilike.%positiv%,sentimento_cliente.ilike.%satisfe%,sentimento_cliente.ilike.%feliz%,sentimento_cliente.ilike.%bom%,sentimento_cliente.ilike.%ótimo%,sentimento_cliente.ilike.%otimo%,sentimento_cliente.ilike.%excelente%'
    )
  } else if (sentimento === 'negativo') {
    query = query.or(
      'sentimento_cliente.ilike.%negativ%,sentimento_cliente.ilike.%insatisfe%,sentimento_cliente.ilike.%irrita%,sentimento_cliente.ilike.%frustra%,sentimento_cliente.ilike.%ruim%,sentimento_cliente.ilike.%péssimo%,sentimento_cliente.ilike.%pessimo%,sentimento_cliente.ilike.%raiva%'
    )
  } else if (sentimento === 'neutro') {
    query = query.or(
      'sentimento_cliente.ilike.%neutr%,sentimento_cliente.ilike.%ok%,sentimento_cliente.ilike.%indifer%'
    )
  }

  return query
}

function recordTime(row: DedupeRow): number {
  const timestamp = Date.parse(row.criado_em || row.data_hora_chegada || '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const pageSize = Math.min(Math.max(1, Number(searchParams.get('pageSize')) || 30), 100)
  const status = searchParams.get('status')

  // Primeiro carregamos apenas os campos mínimos necessários para aplicar a
  // regra global antes da paginação. O status não é filtrado no banco: uma
  // resolução precisa continuar visível à regra e separar duas transferências.
  const rawRows: DedupeRow[] = []
  let truncated = false
  let offset = 0

  while (true) {
    let query = supabase
      .from('atendimentos')
      .select(
        'id,status,criado_em,data_hora_chegada,hub_cliente_id,cnpj,phone,whatsapp_contato'
      )
      .order('criado_em', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1)

    query = applyNonStatusFilters(query, searchParams)
    const { data, error } = await query
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const batch = (data ?? []) as unknown as DedupeRow[]
    rawRows.push(...batch)
    if (batch.length < BATCH_SIZE) break

    offset += BATCH_SIZE
    if (rawRows.length >= MAX_TOTAL_ROWS) {
      truncated = true
      break
    }
  }

  const allDedupedRows = dedupeConsecutiveTransfers(rawRows)
  const dedupedRows = allDedupedRows
    .filter((row) => !status || status === 'all' || row.status === status)
    .sort((a, b) => recordTime(b) - recordTime(a) || Number(b.id) - Number(a.id))

  const total = dedupedRows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageStart = (page - 1) * pageSize
  const pageIds = dedupedRows.slice(pageStart, pageStart + pageSize).map((row) => row.id)

  if (pageIds.length === 0) {
    return Response.json({
      data: [],
      total,
      page,
      pageSize,
      totalPages,
      duplicatesHidden: rawRows.length - allDedupedRows.length,
      truncated,
    })
  }

  const { data, error } = await supabase.from('atendimentos').select('*').in('id', pageIds)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const byId = new Map((data ?? []).map((row) => [String(row.id), row]))
  const orderedData = pageIds
    .map((id) => byId.get(String(id)))
    .filter((row): row is AtendimentoRecord => Boolean(row))

  return Response.json({
    data: orderedData,
    total,
    page,
    pageSize,
    totalPages,
    duplicatesHidden: rawRows.length - allDedupedRows.length,
    truncated,
  })
}
