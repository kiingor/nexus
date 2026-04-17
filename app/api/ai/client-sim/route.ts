import { NextRequest } from 'next/server'
import { getOpenAIClient } from '@/lib/openai'

// POST /api/ai/client-sim
// Proxy for the simulated client AI — always uses a neutral model with NO KB access.
// Used when the simulation page has no direct OpenAI API key configured.
export async function POST(request: NextRequest) {
  try {
    const { messages, max_tokens } = await request.json() as {
      messages: Array<{ role: string; content: string }>
      max_tokens?: number
    }

    if (!messages?.length) {
      return Response.json({ error: 'messages é obrigatório' }, { status: 400 })
    }

    const openai = getOpenAIClient()

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: max_tokens ?? 150,
      messages: messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    })

    return Response.json({ choices: [{ message: { content: response.choices[0]?.message?.content ?? '' } }] })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return Response.json({ error: msg }, { status: 500 })
  }
}
