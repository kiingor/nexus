import { createHash, randomBytes } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'

const KEY_PREFIX = 'nxs_'
const RAW_BYTES = 32 // 32 bytes → ~43 chars base64url

export interface McpApiKeyRow {
  id: string
  name: string
  prefix: string
  key_hash: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

/**
 * Gera uma nova bearer key. Retorna plaintext UMA única vez (para mostrar na UI)
 * + hash a ser persistido.
 */
export function generateKey(): { plaintext: string; hash: string; prefix: string } {
  const raw = randomBytes(RAW_BYTES).toString('base64url')
  const plaintext = `${KEY_PREFIX}${raw}`
  const hash = hashKey(plaintext)
  const prefix = plaintext.slice(0, 12) // "nxs_" + 8 chars
  return { plaintext, hash, prefix }
}

export function hashKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

/**
 * Valida uma bearer key contra a tabela mcp_api_keys.
 * Também aceita o legacy API_SECRET_KEY do .env.
 * Atualiza last_used_at quando encontrada.
 * Retorna true se autorizado.
 */
export async function validateBearer(plaintext: string): Promise<boolean> {
  if (!plaintext) return false

  // Legacy env fallback
  if (plaintext === process.env.API_SECRET_KEY) return true

  const hash = hashKey(plaintext)
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('mcp_api_keys')
    .select('id, revoked_at')
    .eq('key_hash', hash)
    .is('revoked_at', null)
    .maybeSingle()

  if (error || !data) return false

  // Fire-and-forget last_used_at
  supabase
    .from('mcp_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {}, () => {})

  return true
}
