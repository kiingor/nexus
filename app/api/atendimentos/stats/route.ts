import { NextRequest } from 'next/server'
import { dedupeConsecutiveTransfers } from '@/lib/atendimento-dedup'
import { createServerClient } from '@/lib/supabase/server'

const BATCH_SIZE = 1000
const MAX_TOTAL_ROWS = 500_000

type StatsRow = {
  id: number
  status: string | null
  criado_em: string | null
  data_hora_chegada: string | null
  hub_cliente_id: string | null
  cnpj: string | null
  phone: string | null
  whatsapp_contato: string | null
  custo_real: number | string | null
}
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
  const subsetorNome = searchParams.get('subsetor_nome')

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
  if (soComProblema) query = query.eq('problema_extraido->>tem_problema_extraivel', 'true')
  if (soValidados) query = query.or('validado.eq.true,validacao_transf.not.is.null')
  if (tipoContato === 'ligacao' || tipoContato === 'chat') {
    query = query.eq('tipo_contato', tipoContato)
  }
  if (pdv) query = query.eq('pdv', pdv)
  if (tipoAtendimento) query = query.eq('tipo_atendimento', tipoAtendimento)
  if (subsetorNome) query = query.eq('subsetor_nome', subsetorNome)

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
      `subsetor_nome.ilike.${pattern}`,
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

function matchesEffectiveDate(row: StatsRow, searchParams: URLSearchParams): boolean {
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from && !to) return true

  const effective = Date.parse(row.data_hora_chegada || row.criado_em || '')
  if (!Number.isFinite(effective)) return false
  if (from && effective < Date.parse(from)) return false
  if (to && effective > Date.parse(to)) return false
  return true
}

export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const { searchParams } = new URL(request.url)
  const requestedStatus = searchParams.get('status')
  const rawRows: StatsRow[] = []
  let offset = 0

  while (true) {
    let query = supabase
      .from('atendimentos')
      .select(
        'id,status,criado_em,data_hora_chegada,hub_cliente_id,cnpj,phone,whatsapp_contato,custo_real'
      )
      .order('criado_em', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1)

    query = applyNonStatusFilters(query, searchParams)
    const { data, error } = await query
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const batch = (data ?? []) as unknown as StatsRow[]
    rawRows.push(...batch)
    if (batch.length < BATCH_SIZE || rawRows.length >= MAX_TOTAL_ROWS) break
    offset += BATCH_SIZE
  }

  const effectiveRows = rawRows.filter((row) => matchesEffectiveDate(row, searchParams))
  const dedupedRows = dedupeConsecutiveTransfers(effectiveRows)
  const visibleRows = dedupedRows.filter(
    (row) => !requestedStatus || requestedStatus === 'all' || row.status === requestedStatus
  )

  const count = (status: string) => dedupedRows.filter((row) => row.status === status).length
  const custoTotal = visibleRows.reduce((sum, row) => {
    const value = row.custo_real == null ? 0 : Number(row.custo_real)
    return Number.isFinite(value) ? sum + value : sum
  }, 0)

  return Response.json({
    total: visibleRows.length,
    em_atendimento: count('em_atendimento'),
    resolvida_ia: count('resolvida_ia'),
    resolvido_parcialmente: count('resolvido_parcialmente'),
    transferida: count('transferida'),
    interrompida: count('interrompida'),
    custoTotal,
    duplicatesHidden: effectiveRows.length - dedupedRows.length,
  })
}
