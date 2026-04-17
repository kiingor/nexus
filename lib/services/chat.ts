import { getOpenAIClient } from '@/lib/openai'
import { createServerClient } from '@/lib/supabase/server'
import { searchKnowledge } from './knowledge-search'
import type { ChatMessage } from '@/lib/types'

export interface ChatWithKnowledgeParams {
  message: string
  productSlug?: string
  model?: string
  history?: ChatMessage[]
  systemPromptAppend?: string
}

export interface ChatWithKnowledgeResult {
  response: string
  model: string
  rag: boolean
}

function isFineTuned(model: string): boolean {
  const ft1 = process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL
  const ft2 = process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL_V2
  return (!!ft1 && model === ft1) || (!!ft2 && model === ft2)
}

async function getProductListHint(productId: string | null): Promise<string> {
  if (productId) return ''
  const supabase = createServerClient()
  const { data: products } = await supabase
    .from('products')
    .select('name')
    .order('name')
  if (!products || products.length <= 1) return ''
  return `\nProdutos disponíveis: ${products.map((p) => p.name).join(', ')}.`
}

export async function chatWithKnowledge(
  params: ChatWithKnowledgeParams
): Promise<ChatWithKnowledgeResult> {
  const selectedModel = params.model || 'gpt-4.1-mini'
  const fineTuned = isFineTuned(selectedModel)

  const search = await searchKnowledge({
    query: params.message,
    productSlug: params.productSlug,
  })

  const contextName = search.productName || 'toda a base de conhecimento'
  const productListHint = await getProductListHint(search.productId)

  const productGuard = productListHint
    ? `\n\nREGRA OBRIGATÓRIA: NUNCA presuma qual produto o cliente usa. Se o cliente não mencionou EXPLICITAMENTE o nome do produto nesta conversa, pergunte de forma clara e objetiva qual sistema ele utiliza, listando as opções: ${productListHint
        .replace('\nProdutos disponíveis: ', '')
        .replace('.', '')}. Só responda a dúvida depois que o cliente confirmar o produto. Se a resposta do cliente for vaga (ex: "o que uso no navegador", "o sistema da empresa"), insista gentilmente pedindo o nome exato do produto.`
    : ''

  const knowledgeContext = search.fallbackContext

  let systemPrompt: string
  if (fineTuned) {
    systemPrompt = knowledgeContext
      ? `Você é um assistente de suporte especializado em ${contextName}.${productGuard}
Responda com base no seu conhecimento. Use o contexto adicional abaixo se relevante.
Se não souber a resposta, diga claramente.

CONTEXTO ADICIONAL:
${knowledgeContext}`
      : `Você é um assistente de suporte especializado em ${contextName}.${productGuard}
Responda com base no seu conhecimento. Se não souber a resposta, diga claramente.`
  } else {
    systemPrompt = `Você é um assistente de suporte com acesso a ${contextName}.${productGuard}
Responda APENAS com base no conhecimento fornecido abaixo.
Se não souber a resposta ou se ela não estiver na base de conhecimento, diga claramente que não encontrou essa informação na base.
Seja objetivo e direto nas respostas.
Use formatação simples (sem markdown complexo).

BASE DE CONHECIMENTO:
${knowledgeContext}`
  }

  if (params.systemPromptAppend) {
    systemPrompt += `\n\nINSTRUÇÕES ADICIONAIS:\n${params.systemPromptAppend}`
  }

  const openai = getOpenAIClient()

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...(params.history || []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: params.message },
  ]

  const response = await openai.chat.completions.create({
    model: selectedModel,
    max_tokens: 2048,
    temperature: fineTuned ? 0.3 : undefined,
    messages,
  })

  const responseText = response.choices[0]?.message?.content
  if (!responseText) {
    throw new Error('Sem resposta da IA')
  }

  return { response: responseText, model: selectedModel, rag: search.usedRAG }
}
