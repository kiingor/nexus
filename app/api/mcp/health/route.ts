export const runtime = 'nodejs'

export async function GET() {
  return Response.json({
    ok: true,
    server: 'nexus-mcp',
    version: '0.1.0',
    endpoint: '/api/mcp/mcp',
  })
}
