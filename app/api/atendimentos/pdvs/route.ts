import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('atendimentos')
    .select('pdv')
    .not('pdv', 'is', null)
    .neq('pdv', '')
    .order('pdv', { ascending: true })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const pdvs = Array.from(new Set((data ?? []).map((r) => r.pdv as string).filter(Boolean))).sort()

  return Response.json({ pdvs })
}
