import { NextRequest } from 'next/server'
import {
  getIaRouterClient,
  getOpenAIClient,
  hasIaRouter,
  IAROUTER_MODEL,
} from '@/lib/openai'

type ChatClient = ReturnType<typeof getIaRouterClient>

const REQUEST_TIMEOUT_MS = 18_000

function isTransientAiError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const candidate = error as {
    status?: number
    code?: string
    message?: string
    cause?: { code?: string; message?: string }
  }
  const status = Number(candidate.status || 0)
  const text = `${candidate.code || ''} ${candidate.message || ''} ${candidate.cause?.code || ''} ${candidate.cause?.message || ''}`

  return (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status >= 500 ||
    /timeout|timed out|econn|socket|fetch failed|network|bad gateway|service unavailable/i.test(text)
  )
}

async function waitBeforeRetry(attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
}

async function generateWithRetry(
  client: ChatClient,
  model: string,
  type: 'instruction' | 'error',
  prompt: string,
  maxAttempts: number
): Promise<string> {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model,
        temperature: 0.3,
        max_tokens: 2048,
        messages: [
          { role: 'system', content: type === 'instruction' ? INSTRUCTION_SYSTEM_PROMPT : ERROR_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      }, { timeout: REQUEST_TIMEOUT_MS })

      const text = response.choices[0]?.message?.content
      if (!text) throw new Error('Sem resposta da IA')
      return text
    } catch (error) {
      lastError = error
      if (!isTransientAiError(error) || attempt === maxAttempts) break
      await waitBeforeRetry(attempt)
    }
  }

  throw lastError
}

const INSTRUCTION_SYSTEM_PROMPT = `Você é um assistente especializado em estruturar bases de conhecimento para agentes de IA.
O usuário vai descrever um processo em linguagem natural.
Retorne APENAS um objeto JSON válido, sem markdown, sem explicações, sem texto fora do JSON.

REGRAS IMPORTANTES:
- NÃO invente informações. Use APENAS o que o usuário descreveu.
- O campo "orientacao" só deve ser preenchido se o usuário mencionou onde o elemento fica na tela. Se não mencionou, use null.
- O campo "atalho" só deve ser preenchido se o usuário mencionou um atalho de teclado. Se não mencionou, use null.
- Não adicione passos que o usuário não descreveu.

A estrutura deve ser exatamente:
{
  "title": "Título curto e descritivo do processo",
  "type": "instruction",
  "keywords": ["Frases que o usuário diria ao buscar este processo"],
  "steps": [
    {
      "passo": 1,
      "acao": "Ação descrita pelo usuário",
      "orientacao": null,
      "atalho": null
    }
  ]
}
Gere entre 5 e 10 palavras-chave que representem formas naturais que um usuário usaria para buscar esse processo.`

const ERROR_SYSTEM_PROMPT = `Você é um assistente especializado em estruturar bases de conhecimento para agentes de IA.
O usuário vai descrever um erro de sistema em linguagem natural.
Retorne APENAS um objeto JSON válido, sem markdown, sem explicações, sem texto fora do JSON.

REGRAS IMPORTANTES:
- NÃO invente informações. Use APENAS o que o usuário descreveu.
- O campo "orientation" só deve ser preenchido se o usuário mencionou onde o erro aparece na tela. Se não mencionou, use null.
- O campo "error_code" só deve ser preenchido se o usuário mencionou um código de erro. Se não mencionou, use null.

A estrutura deve ser exatamente:
{
  "title": "Título curto e descritivo do erro",
  "type": "error",
  "keywords": ["Frases que o usuário diria ao relatar este erro"],
  "error_code": null,
  "description": "O que o erro significa para o usuário",
  "cause": "Por que esse erro acontece",
  "solution": "Como resolver passo a passo, em texto corrido",
  "orientation": null
}
Gere entre 5 e 10 palavras-chave que representem formas naturais que um usuário usaria para relatar esse erro.`

export async function POST(request: NextRequest) {
  try {
    const { prompt, type } = await request.json()

    if (!prompt || !type) {
      return Response.json(
        { error: 'Campos "prompt" e "type" são obrigatórios.' },
        { status: 400 }
      )
    }

    // Prefere o gateway iarouter. Em falha transitória, repete uma vez e,
    // quando há uma chave OpenAI direta disponível, usa-a como fallback.
    const usarGateway = hasIaRouter()
    const temFallbackDireto = usarGateway && !!process.env.OPENAI_API_KEY
    const providers: Array<{ client: ChatClient; model: string; name: string; attempts: number }> = usarGateway
      ? [{ client: getIaRouterClient(), model: IAROUTER_MODEL, name: 'iarouter', attempts: temFallbackDireto ? 1 : 2 }]
      : [{ client: getOpenAIClient(), model: 'gpt-4.1-mini', name: 'openai', attempts: 2 }]

    if (temFallbackDireto) {
      providers.push({ client: getOpenAIClient(), model: 'gpt-4.1-mini', name: 'openai-fallback', attempts: 1 })
    }

    let text = ''
    let lastError: unknown
    for (const provider of providers) {
      try {
        text = await generateWithRetry(provider.client, provider.model, type, prompt, provider.attempts)
        break
      } catch (error) {
        lastError = error
        console.error(`AI generate provider failed (${provider.name}):`, error)
      }
    }

    if (!text) throw lastError || new Error('Sem resposta da IA')

    // O gateway às vezes embrulha o JSON em cercas de código.
    const limpo = text.replace(/```json/gi, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(limpo)

    return Response.json({
      title: parsed.title,
      keywords: parsed.keywords || [],
      content:
        type === 'instruction'
          ? { type: 'instruction', steps: parsed.steps }
          : {
              type: 'error',
              error_code: parsed.error_code,
              description: parsed.description,
              cause: parsed.cause,
              solution: parsed.solution,
              orientation: parsed.orientation,
            },
    })
  } catch (error) {
    console.error('AI generate error:', error)
    return Response.json(
      { error: 'O serviço de IA está temporariamente indisponível. Tente novamente em alguns instantes.' },
      { status: 502 }
    )
  }
}
