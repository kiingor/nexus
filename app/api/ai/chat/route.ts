import { NextRequest } from 'next/server'
import { getOpenAIClient } from '@/lib/openai'
import { createServerClient } from '@/lib/supabase/server'
import { generateQueryEmbedding } from '@/lib/embeddings'
import type { InstructionContent, ErrorContent, ChatMessage } from '@/lib/types'

// ---------------------------------------------------------------------------
// Context builders
// ---------------------------------------------------------------------------

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

function buildRAGContext(matches: Array<{
  chunk_text: string
  similarity: number
  item_title: string
}>): string {
  if (!matches || matches.length === 0) return ''

  const seen = new Set<string>()
  const sections: string[] = []

  for (const match of matches) {
    if (seen.has(match.item_title)) continue
    seen.add(match.item_title)
    sections.push(match.chunk_text)
  }

  return sections.join('\n\n---\n\n')
}

// ---------------------------------------------------------------------------
// POST /api/ai/chat
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // API key auth for external access (optional for internal Nexus UI)
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const isExternalCall = !!apiKey

    if (isExternalCall && apiKey !== process.env.API_SECRET_KEY) {
      return Response.json({ error: 'API key inválida.' }, { status: 401 })
    }

    const { message, productSlug, model, history, systemPrompt: customSystemPrompt } = await request.json() as {
      message: string
      productSlug?: string
      model?: string
      history?: ChatMessage[]
      systemPrompt?: string
    }

    if (!message) {
      return Response.json(
        { error: 'Campo "message" é obrigatório.' },
        { status: 400 }
      )
    }

    const selectedModel = model || 'gpt-4.1-mini'
    const isFineTuned = process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL
      && selectedModel === process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL

    const supabase = createServerClient()

    // Resolve product filter
    let productId: string | null = null
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
      productId = product.id
    }

    // --- RAG: vector similarity search ---
    let knowledgeContext = ''
    let usedRAG = false

    try {
      const queryEmbedding = await generateQueryEmbedding(message)

      const { data: matches, error: rpcError } = await supabase.rpc('match_documents_openai', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: 0.65,
        match_count: 10,
        filter_product_id: productId,
      })

      if (!rpcError && matches && matches.length > 0) {
        knowledgeContext = buildRAGContext(matches)
        usedRAG = true
      }
    } catch (ragError) {
      console.warn('RAG search failed, falling back to full context:', ragError)
    }

    // --- Fallback: load all items ---
    if (!usedRAG) {
      let items
      if (productId) {
        const { data } = await supabase
          .from('knowledge_items')
          .select('*, modules!inner(product_id, name)')
          .eq('modules.product_id', productId)
          .eq('is_active', true)
        items = data
      } else {
        const { data } = await supabase
          .from('knowledge_items')
          .select('*, modules!inner(name)')
          .eq('is_active', true)
        items = data
      }

      knowledgeContext = buildKnowledgeContext(
        (items || []).map((i) => ({
          ...i,
          modules: (i as Record<string, unknown> & { modules: { name: string } }).modules,
        }))
      )
    }

    // --- Build system prompt ---
    let systemPrompt: string

    if (isFineTuned) {
      // Fine-tuned model: lighter prompt, RAG as boost
      systemPrompt = knowledgeContext
        ? `Você é um assistente de suporte especializado em ${contextName}.\nResponda com base no seu conhecimento. Use o contexto adicional abaixo se relevante.\nSe não souber a resposta, diga claramente.\n\nCONTEXTO ADICIONAL:\n${knowledgeContext}`
        : `Você é um assistente de suporte especializado em ${contextName}.\nResponda com base no seu conhecimento. Se não souber a resposta, diga claramente.`
    } else {
      // Standard model: full context injection
      systemPrompt = `Você é um assistente de suporte com acesso a ${contextName}.
Responda APENAS com base no conhecimento fornecido abaixo.
Se não souber a resposta ou se ela não estiver na base de conhecimento, diga claramente que não encontrou essa informação na base.
Seja objetivo e direto nas respostas.
Use formatação simples (sem markdown complexo).

BASE DE CONHECIMENTO:
${knowledgeContext}`
    }

    // Append custom instructions from caller
    if (customSystemPrompt) {
      systemPrompt += `\n\nINSTRUÇÕES ADICIONAIS:\n${customSystemPrompt}`
    }

    // --- Call OpenAI ---
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

    return Response.json({ response: responseText, model: selectedModel, rag: usedRAG })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('AI chat error:', errMsg)
    return Response.json(
      { error: `Erro ao processar mensagem: ${errMsg}` },
      { status: 500 }
    )
  }
}
