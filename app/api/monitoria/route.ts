import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { MonitoriaInput } from '@/lib/types'

function normalize(body: MonitoriaInput) {
  return {
    nota_avaliacao: body.nota_avaliacao ?? null,
    data_avaliacao: body.data_avaliacao ?? new Date().toISOString(),
    transcricao: body.transcricao ?? null,
    nota_cliente: body.nota_cliente ?? null,
    ramal: body.ramal ?? null,
    numero_contato: body.numero_contato ?? null,
    questionario: body.questionario ?? null,
  }
}

export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const { searchParams } = new URL(request.url)

  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500)
  const ramal = searchParams.get('ramal')
  const numero = searchParams.get('numero_contato')

  let query = supabase
    .from('monitoria')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (ramal) query = query.eq('ramal', ramal)
  if (numero) query = query.eq('numero_contato', numero)

  const { data, error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data || [])
}

export async function POST(request: NextRequest) {
  // External calls (e.g. n8n) must send Bearer token; internal UI skips auth
  const authHeader = request.headers.get('authorization')
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const isExternalCall = !!apiKey

  if (isExternalCall && apiKey !== process.env.API_SECRET_KEY) {
    return Response.json({ error: 'API key inválida.' }, { status: 401 })
  }

  let body: MonitoriaInput | MonitoriaInput[]
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Batch insert when array is sent
  if (Array.isArray(body)) {
    if (body.length === 0) {
      return Response.json({ error: 'Array vazio.' }, { status: 400 })
    }

    const payload = body.map(normalize)
    const { data, error } = await supabase
      .from('monitoria')
      .insert(payload)
      .select()

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ count: data?.length || 0, records: data || [] }, { status: 201 })
  }

  const { data, error } = await supabase
    .from('monitoria')
    .insert(normalize(body))
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
