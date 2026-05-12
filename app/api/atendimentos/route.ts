import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const { searchParams } = new URL(request.url)

  // ── Paginação ─────────────────────────────────────────────────────────
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const pageSize = Math.min(
    Math.max(1, Number(searchParams.get('pageSize')) || 30),
    100
  )
  const offset = (page - 1) * pageSize

  // ── Filtros ───────────────────────────────────────────────────────────
  const status = searchParams.get('status')
  const destino = searchParams.get('destino')
  const cnpj = searchParams.get('cnpj')
  const phone = searchParams.get('phone')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const soComProblema = searchParams.get('com_problema') === 'true'
  const search = (searchParams.get('search') || '').trim()
  const sentimento = searchParams.get('sentimento') // positivo | neutro | negativo

  // Ordena por criado_em desc, nulos no fim, fallback por id.
  let query = supabase
    .from('atendimentos')
    .select('*', { count: 'exact' })
    .order('criado_em', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (status) query = query.eq('status', status)
  if (destino) query = query.eq('destino', destino)
  if (cnpj) query = query.eq('cnpj', cnpj)
  if (phone) query = query.eq('phone', phone)
  if (from) query = query.gte('criado_em', from)
  if (to) query = query.lt('criado_em', to)
  if (soComProblema)
    query = query.eq('problema_extraido->>tem_problema_extraivel', 'true')

  // Busca: ILIKE em múltiplas colunas. Se o termo for puramente numérico,
  // também tenta casar com id (cast pra texto).
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
    query = query.or(orParts.join(','))
  }

  // Sentimento: server-side via ILIKE com padrões alinhados aos regex
  // que existiam no client. Múltiplos ORs pra cobrir variações.
  if (sentimento === 'positivo') {
    query = query.or(
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
    query = query.or(
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
    query = query.or(
      [
        'sentimento_cliente.ilike.%neutr%',
        'sentimento_cliente.ilike.%ok%',
        'sentimento_cliente.ilike.%indifer%',
      ].join(',')
    )
  }

  const { data, error, count } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return Response.json({
    data: data ?? [],
    total,
    page,
    pageSize,
    totalPages,
  })
}
