import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServerClient()
  const batchSize = 1000
  const values = new Set<string>()
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('atendimentos')
      .select('subsetor_nome')
      .not('subsetor_nome', 'is', null)
      .neq('subsetor_nome', '')
      .order('id', { ascending: true })
      .range(offset, offset + batchSize - 1)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    for (const record of data ?? []) {
      const value = String(record.subsetor_nome || '').trim()
      if (value) values.add(value)
    }

    if ((data ?? []).length < batchSize) break
    offset += batchSize
  }

  const subsetores = Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  return Response.json(
    { subsetores },
    { headers: { 'Cache-Control': 'private, max-age=300' } }
  )
}
