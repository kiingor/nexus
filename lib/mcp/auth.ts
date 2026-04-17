import { validateBearer } from './keys'

/**
 * Bearer token verification.
 * Accepts both the legacy API_SECRET_KEY env and keys from mcp_api_keys table.
 * Returns a 401 Response if invalid, or null if authorized.
 */
export async function verifyBearer(req: Request): Promise<Response | null> {
  const h = req.headers.get('authorization')
  const key = h?.startsWith('Bearer ') ? h.slice(7).trim() : null

  if (!key) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ok = await validateBearer(key)
  if (!ok) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
