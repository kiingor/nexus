import { NextRequest } from 'next/server'
import { getOpenAIClient } from '@/lib/openai'
import { createServerClient } from '@/lib/supabase/server'
import type { InstructionContent, ErrorContent, ChatMessage } from '@/lib/types'

function buildKnowledgeContext(items: Array<{
  title: string
  type: string
  content: InstructionContent | ErrorContent
  modules?: { name: string } | null
}>): string {
  if (items.length === 0) return 'Nenhum conhecimento cadastrado na base.'

  const sections: string[] = []

  for (const item of items) {
    const moduleName = item.modules?.name || 'Geral'

    if (item.type === 'instruction') {
      const content = item.content as InstructionContent
      const stepsText = content.steps
        .map((s) => {
          let text = `  ${s.passo}. ${s.acao}`
          if (s.orientacao) text += ` (${s.orientacao})`
          if (s.atalho) text += ` [Atalho: ${s.atalho}]`
          return text
        })
        .join('\n')

      sections.push(`[Módulo: ${moduleName} | Instrução]\nTítulo: ${item.title}\nPassos:\n${stepsText}`)
    } else {
      const content = item.content as ErrorContent
      let text = `[Módulo: ${moduleName} | Erro]\nTítulo: ${item.title}`
      if (content.error_code) text += `\nCódigo: ${content.error_code}`
      text += `\nDescrição: ${content.description}`
      text += `\nCausa: ${content.cause}`
      text += `\nSolução: ${content.solution}`
      if (content.orientation) text += `\nOrientação: ${content.orientation}`
      sections.push(text)
    }
  }

  return sections.join('\n\n---\n\n')
}

export async function POST(request: NextRequest) {
  try {
    const { message, productSlug, model, history } = await request.json() as {
      message: string
      productSlug?: string
      model?: string
      history?: ChatMessage[]
    }

    if (!message) {
      return Response.json(
        { error: 'Campo "message" é obrigatório.' },
        { status: 400 }
      )
    }

    const selectedModel = model || 'gpt-4.1-mini'

    const supabase = createServerClient()

    let items
    let contextName = 'toda a base de conhecimento'

    if (productSlug) {
      const { data: product } = await supabase
        .from('products')
        .select('id, name')
        .eq('slug', productSlug)
        .single()

      if (!product) {
        return Response.json({ error: 'Produto não encontrado' }, { status: 404 })
      }

      contextName = product.name

      const { data } = await supabase
        .from('knowledge_items')
        .select('*, modules!inner(product_id, name)')
        .eq('modules.product_id', product.id)
        .eq('is_active', true)

      items = data
    } else {
      const { data } = await supabase
        .from('knowledge_items')
        .select('*, modules!inner(name)')
        .eq('is_active', true)

      items = data
    }

    const knowledgeContext = buildKnowledgeContext(
      (items || []).map((i) => ({
        ...i,
        modules: (i as Record<string, unknown> & { modules: { name: string } }).modules,
      }))
    )

    const systemPrompt = `Você é um assistente de suporte com acesso a ${contextName}.
Responda APENAS com base no conhecimento fornecido abaixo.
Se não souber a resposta ou se ela não estiver na base de conhecimento, diga claramente que não encontrou essa informação na base.
Seja objetivo e direto nas respostas.
Use formatação simples (sem markdown complexo).

BASE DE CONHECIMENTO:
${knowledgeContext}`

    // Use OpenAI for all models
    const openai = getOpenAIClient()

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...(history || []).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ]

    const response = await openai.chat.completions.create({
      model: selectedModel,
      max_tokens: 2048,
      messages,
    })

    const responseText = response.choices[0]?.message?.content
    if (!responseText) {
      return Response.json({ error: 'Sem resposta da IA' }, { status: 500 })
    }

    return Response.json({ response: responseText, model: selectedModel })
  } catch (error) {
    console.error('AI chat error:', error)
    return Response.json(
      { error: 'Erro ao processar mensagem. Verifique a API key.' },
      { status: 500 }
    )
  }
}
