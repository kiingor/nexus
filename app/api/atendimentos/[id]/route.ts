import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('atendimentos')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'Não encontrado' }, { status: 404 })

  let avaliacoes: unknown[] = []
  if (data.phone && data.cnpj) {
    const { data: av } = await supabase
      .from('avaliacoes_atendimento')
      .select('*')
      .eq('phone', data.phone)
      .eq('cnpj', data.cnpj)
      .order('criado_em', { ascending: false })
      .limit(5)
    avaliacoes = av || []
  }

  return Response.json({ atendimento: data, avaliacoes })
}
