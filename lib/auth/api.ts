import { NextRequest } from 'next/server'

export function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey) return false
  return apiKey === process.env.API_SECRET_KEY
}

export function unauthorizedResponse() {
  return Response.json(
    { error: 'Unauthorized. Provide a valid x-api-key header.' },
    { status: 401 }
  )
}
