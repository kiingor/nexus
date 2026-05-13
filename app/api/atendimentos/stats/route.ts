/**
 * GET /api/atendimentos/stats
 *
 * Retorna contadores e soma de custo agregados sobre TODOS os atendimentos
 * que casam com os filtros (sem paginação). Usado pelos cards da página.
 *
 * Query params: mesmos da rota /api/atendimentos (status, destino, from,
 * to, search, sentimento, com_problema), exceto page/pageSize.
 *
 * Resposta:
 * {
 *   total: number,
 *   em_atendimento: number,
 *   resolvida_ia: number,
 *   transferida: number,
 *   interrompida: number,
 *   custoTotal: number
 * }
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

type Counts = {
  total: number
  em_atendimento: number
  resolvida_ia: number
  transferida: number
  interrompida: number
  custoTotal: number
}

// Generic constraint: aceita qualquer query builder do Supabase JS que
// suporte os métodos abaixo e retorne ele mesmo (encadeável). Isso cobre
// tanto chains iniciadas com .select(*, { count: 'exact', head: true })
// quanto .select('col') usadas pra somar custo.
type FilterableQuery<T> = {
  eq: (col: string, val: unknown) => T
  gte: (col: string, val: unknown) => T
  lt: (col: string, val: unknown) => T
  or: (filters: string) => T
}

function applyFilters<T extends FilterableQuery<T>>(
  q: T,
  searchParams: URLSearchParams,
  excludeStatus = false
): T {
  const status = searchParams.get('status')
  const destino = searchParams.get('destino')
  const cnpj = searchParams.get('cnpj')
  const phone = searchParams.get('phone')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const soComProblema = searchParams.get('com_problema') === 'true'
  const search = (searchParams.get('search') || '').trim()
  const sentimento = searchParams.get('sentimento')
  const tipoContato = searchParams.get('tipo_contato')

  if (!excludeStatus && status) q = q.eq('status', status)
  if (destino) q = q.eq('destino', destino)
  if (cnpj) q = q.eq('cnpj', cnpj)
  if (phone) q = q.eq('phone', phone)
  if (from) q = q.gte('criado_em', from)
  if (to) q = q.lt('criado_em', to)
  if (soComProblema) q = q.eq('problema_extraido->>tem_problema_extraivel', 'true')
  if (tipoContato === 'ligacao' || tipoContato === 'chat')
    q = q.eq('tipo_contato', tipoContato)

  if (search) {
    const escaped = search.replace(/[%_]/g, '\\$&')
    const pat = `%${escaped}%`
    const orParts = [
      `nome_empresa.ilike.${pat}`,
      `cnpj.ilike.${pat}`,
      `phone.ilike.${pat}`,
      `cliente_nome.ilike.${pat}`,
      `problema_relatado.ilike.${pat}`,
      `id_ligacao.ilike.${pat}`,
    ]
    if (/^\d+$/.test(search)) orParts.push(`id.eq.${search}`)
    q = q.or(orParts.join(','))
  }

  if (sentimento === 'positivo') {
    q = q.or(
      'sentimento_cliente.ilike.%positiv%,sentimento_cliente.ilike.%satisfe%,sentimento_cliente.ilike.%feliz%,sentimento_cliente.ilike.%bom%,sentimento_cliente.ilike.%ótimo%,sentimento_cliente.ilike.%otimo%,sentimento_cliente.ilike.%excelente%'
    )
  } else if (sentimento === 'negativo') {
    q = q.or(
      'sentimento_cliente.ilike.%negativ%,sentimento_cliente.ilike.%insatisfe%,sentimento_cliente.ilike.%irrita%,sentimento_cliente.ilike.%frustra%,sentimento_cliente.ilike.%ruim%,sentimento_cliente.ilike.%péssimo%,sentimento_cliente.ilike.%pessimo%,sentimento_cliente.ilike.%raiva%'
    )
  } else if (sentimento === 'neutro') {
    q = q.or(
      'sentimento_cliente.ilike.%neutr%,sentimento_cliente.ilike.%ok%,sentimento_cliente.ilike.%indifer%'
    )
  }

  return q
}

async function countStatus(
  supabase: ReturnType<typeof createServerClient>,
  searchParams: URLSearchParams,
  statusValue: string
): Promise<number> {
  let q = supabase
    .from('atendimentos')
    .select('id', { count: 'exact', head: true })
  q = applyFilters(q, searchParams, true).eq('status', statusValue)
  const { count, error } = await q
  if (error) return 0
  return count ?? 0
}

export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const { searchParams } = new URL(request.url)

  // Count total (respeitando o filtro de status atual, se houver)
  let totalQuery = supabase
    .from('atendimentos')
    .select('id', { count: 'exact', head: true })
  totalQuery = applyFilters(totalQuery, searchParams)
  const totalRes = await totalQuery

  if (totalRes.error) {
    return Response.json({ error: totalRes.error.message }, { status: 500 })
  }

  // Counts por status — sempre todos, ignorando o filtro de status atual,
  // pra que os cards mostrem a distribuição real do conjunto filtrado.
  const [emAtendimento, resolvida, transferida, interrompida] = await Promise.all([
    countStatus(supabase, searchParams, 'em_atendimento'),
    countStatus(supabase, searchParams, 'resolvida_ia'),
    countStatus(supabase, searchParams, 'transferida'),
    countStatus(supabase, searchParams, 'interrompida'),
  ])

  // Soma de custo_real: usa o mesmo filtro do total. Como o Supabase JS
  // não tem helper de sum() agregado direto, fazemos uma query separada
  // selecionando custo_real e somando aqui — limitado a 5000 linhas pra
  // segurança (cobre praticamente todo cenário plausível).
  let custoQuery = supabase
    .from('atendimentos')
    .select('custo_real')
    .limit(5000)
  custoQuery = applyFilters(custoQuery, searchParams)
  const custoRes = await custoQuery

  let custoTotal = 0
  if (!custoRes.error && custoRes.data) {
    for (const row of custoRes.data) {
      const v = row.custo_real
      if (v == null) continue
      const n = typeof v === 'number' ? v : Number(v)
      if (!Number.isNaN(n)) custoTotal += n
    }
  }

  const result: Counts = {
    total: totalRes.count ?? 0,
    em_atendimento: emAtendimento,
    resolvida_ia: resolvida,
    transferida: transferida,
    interrompida: interrompida,
    custoTotal,
  }

  return Response.json(result)
}
