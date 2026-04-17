import { handler as mcp } from '@/lib/mcp/server'
import { verifyBearer } from '@/lib/mcp/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function guarded(req: Request): Promise<Response> {
  const denied = await verifyBearer(req)
  if (denied) return denied
  return mcp(req)
}

export { guarded as GET, guarded as POST, guarded as DELETE }
