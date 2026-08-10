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
  'tipo_contato',
  'sentimento_cliente',
  'pdv',
  'problema_extraido',
  'validado',
  'validacao_transf',
  'id_ligacao',
].join(',')

export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const retornoStatus = searchParams.get('status')
  const retornoDestino = searchParams.get('destino')
  const tipoContato = searchParams.get('tipo_contato')
  const sentimento = searchParams.get('sentimento')
  const pdv = searchParams.get('pdv')
  const tipoAtendimento = searchParams.get('tipo_atendimento')
  const comProblema = searchParams.get('com_problema') === 'true'
  const validados = searchParams.get('validados') === 'true'
  const search = (searchParams.get('search') || '').trim()

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

    // Como retorno válido precisa ocorrer no mesmo dia da resolução, todos
    // os registros necessários estão dentro do próprio período consultado.
    // Usa a mesma data efetiva da Lista: data_hora_chegada com fallback em
    // criado_em.
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

  const result = calcularEfetividade(rows, {
    from,
    to,
    retornoStatus,
    retornoDestino,
    tipoContato,
    sentimento,
    pdv,
    tipoAtendimento,
    comProblema,
    validados,
    search,
  })
  const totalCasos = result.casos.length

  return Response.json({
    ...result,
    casos: result.casos.slice(0, MAX_CASES_IN_RESPONSE),
    totalCasos,
    truncated: truncated || totalCasos > MAX_CASES_IN_RESPONSE,
  })
}
