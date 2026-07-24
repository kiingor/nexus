import OpenAI from 'openai'

let client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    })
  }
  return client
}

// Cliente do gateway Softcom IA (iarouter), compatível com a API da OpenAI.
// Usado na geração de conteúdo porque a conta OpenAI direta pode estar sem
// chave válida. O gateway roteia por modelos `codex/*` e `claude-*` — os
// modelos `gpt-*` da OpenAI não estão ativos nele.
let iaRouter: OpenAI | null = null

export function getIaRouterClient(): OpenAI {
  if (!iaRouter) {
    iaRouter = new OpenAI({
      apiKey: process.env.IAROUTER_API_KEY || process.env.OPENAI_API_KEY || '',
      baseURL: process.env.IAROUTER_BASE_URL || 'https://iarouter.softcomia.com/v1',
    })
  }
  return iaRouter
}

// Modelo de geração no gateway. Configurável por env; default validado.
export const IAROUTER_MODEL = process.env.IAROUTER_MODEL || 'codex/gpt-5.5-high'

// True quando o gateway está configurado — aí a geração usa ele em vez da
// OpenAI direta.
export function hasIaRouter(): boolean {
  return !!process.env.IAROUTER_API_KEY
}

export const OPENAI_MODELS: Array<{ id: string; label: string; provider: string }> = [
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'openai' },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', provider: 'openai' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai' },
]

// Add fine-tuned models if configured
if (process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL_V2) {
  OPENAI_MODELS.unshift({
    id: process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL_V2,
    label: 'Nexus AI V2',
    provider: 'openai',
  })
}
if (process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL) {
  OPENAI_MODELS.unshift({
    id: process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL,
    label: 'Nexus AI',
    provider: 'openai',
  })
}

export const ALL_CHAT_MODELS = [...OPENAI_MODELS]
