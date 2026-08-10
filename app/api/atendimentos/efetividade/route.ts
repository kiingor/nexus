import { NextRequest } from 'next/server'
import { calcularEfetividade, type EfetividadeSourceRow } from '@/lib/efetividade'
import { createServerClient } from '@/lib/supabase/server'

const BATCH_SIZE = 1000
const MAX_TOTAL_ROWS = 500_000
const MAX_CASES_IN_RESPONSE = 5000

const SELECT_COLS = [
  'id',
  'status',
  'destino',
  'cnpj',
  'nome_empresa',
  'cliente_nome',
  'phone',
  'whatsapp_contato',
  'problema_relatado',
  'solucao_aplicada',
  'data_hora_chegada',
  'criado_em',
  'tipo_atendimento',
  'hub_cliente_id',
].join(',')

export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const rows: EfetividadeSourceRow[] = []
  let offset = 0
  let truncated = false

  while (true) {
    let query = supabase
      .from('atendimentos')
      .select(SELECT_COLS)
      .in('status', ['resolvida_ia', 'transferida', 'resolvido_parcialmente'])
      .order('criado_em', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1)

    // O período filtra as resoluções, mas precisamos manter todos os registros
    // posteriores para descobrir se houve uma transferência depois. Por isso,
    // apenas o limite inicial pode ser aplicado já na consulta.
    if (from) {
      query = query.or(
        `criado_em.gte.${from},and(criado_em.is.null,data_hora_chegada.gte.${from})`
      )
    }

    const { data, error } = await query
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const batch = (data ?? []) as unknown as EfetividadeSourceRow[]
    rows.push(...batch)
    if (batch.length < BATCH_SIZE) break

    offset += BATCH_SIZE
    if (rows.length >= MAX_TOTAL_ROWS) {
      truncated = true
      break
    }
  }

  const result = calcularEfetividade(rows, { from, to })
  const totalCasos = result.casos.length

  return Response.json({
    ...result,
    casos: result.casos.slice(0, MAX_CASES_IN_RESPONSE),
    totalCasos,
    truncated: truncated || totalCasos > MAX_CASES_IN_RESPONSE,
  })
}
