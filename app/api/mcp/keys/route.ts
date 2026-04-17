import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { generateKey } from '@/lib/mcp/keys'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('mcp_api_keys')
    .select('id, name, prefix, created_at, last_used_at, revoked_at')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data || [])
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const name = typeof body?.name === 'string' ? body.name.trim() : ''

  if (!name) {
    return Response.json({ error: 'Campo "name" é obrigatório.' }, { status: 400 })
  }

  const { plaintext, hash, prefix } = generateKey()

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('mcp_api_keys')
    .insert({ name, prefix, key_hash: hash })
    .select('id, name, prefix, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Retorna plaintext UMA ÚNICA VEZ — cliente guarda
  return Response.json({ ...data, key: plaintext }, { status: 201 })
}
