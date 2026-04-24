import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const { searchParams } = new URL(request.url)

  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500)
  const status = searchParams.get('status')
  const destino = searchParams.get('destino')
  const cnpj = searchParams.get('cnpj')
  const phone = searchParams.get('phone')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const soComProblema = searchParams.get('com_problema') === 'true'

  let query = supabase
    .from('atendimentos')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)
  if (destino) query = query.eq('destino', destino)
  if (cnpj) query = query.eq('cnpj', cnpj)
  if (phone) query = query.eq('phone', phone)
  if (from) query = query.gte('criado_em', from)
  if (to) query = query.lt('criado_em', to)
  if (soComProblema) query = query.eq('problema_extraido->>tem_problema_extraivel', 'true')

  const { data, error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data || [])
}
