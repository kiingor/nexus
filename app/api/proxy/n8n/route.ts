import { NextRequest } from 'next/server'
import { getOpenAIClient } from '@/lib/openai'
import { createServerClient } from '@/lib/supabase/server'
import { generateQueryEmbedding } from '@/lib/embeddings'
import type { InstructionContent, ErrorContent } from '@/lib/types'

// ---------------------------------------------------------------------------
// Context builders (reused from chat route)
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
// POST /api/proxy/n8n - OpenAI-compatible chat completions endpoint
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {
      return Response.json(
        { error: { message: 'Invalid API key', type: 'invalid_request_error', code: 'invalid_api_key' } },
        { status: 401 }
      )
    }

    // Parse OpenAI-compatible request body
    const body = await request.json() as {
      model?: string
      messages: Array<{ role: string; content: string }>
      temperature?: number
      max_tokens?: number
      stream?: boolean
      product_slug?: string
    }

    const { messages, temperature, max_tokens, stream } = body
    const productSlug = body.product_slug

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: { message: 'Missing required parameter: messages', type: 'invalid_request_error', code: 'missing_parameter' } },
        { status: 400 }
      )
    }

    // Extract user message (last user message)
    const userMessage = messages.filter(m => m.role === 'user').pop()
    if (!userMessage) {
      return Response.json(
        { error: { message: 'No user message found in messages array', type: 'invalid_request_error', code: 'missing_user_message' } },
        { status: 400 }
      )
    }

    const selectedModel = body.model || 'gpt-4.1-mini'
    const isFineTuned =
      (process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL && selectedModel === process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL) ||
      (process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL_V2 && selectedModel === process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL_V2)

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
        return Response.json(
          { error: { message: 'Product not found', type: 'invalid_request_error', code: 'product_not_found' } },
          { status: 404 }
        )
      }

      contextName = product.name
      productId = product.id
    }

    // --- RAG: vector similarity search ---
    let knowledgeContext = ''
    let usedRAG = false

    try {
      const queryEmbedding = await generateQueryEmbedding(userMessage.content)

      const { data: matches, error: rpcError } = await supabase.rpc('match_documents_openai', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: 0.65,
        match_count: 10,
        filter_product_id: productId,
      })

      if (!rpcError && matches && matches.length > 0) {
        knowledgeContext = buildRAGContext(matches)
        usedRAG = true
      } else if (productId) {
        // No results for this product — try global search
        const { data: globalMatches, error: globalErr } = await supabase.rpc('match_documents_openai', {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: 0.65,
          match_count: 10,
          filter_product_id: null,
        })
        if (!globalErr && globalMatches && globalMatches.length > 0) {
          knowledgeContext = buildRAGContext(globalMatches)
          usedRAG = true
        }
      }
    } catch (ragError) {
      console.warn('RAG search failed, falling back to full context:', ragError)
    }

    // --- Fallback: load all items ---
    if (!usedRAG) {
      let items
      if (productId) {
        const { data: productItems } = await supabase
          .from('knowledge_items')
          .select('*, modules!inner(product_id, name)')
          .eq('modules.product_id', productId)
          .eq('is_active', true)
        if (productItems && productItems.length > 0) {
          items = productItems
        } else {
          const { data: allItems } = await supabase
            .from('knowledge_items')
            .select('*, modules!inner(name)')
            .eq('is_active', true)
          items = allItems
        }
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
    let systemPrompt = `Você é um assistente de suporte com acesso a ${contextName}.
Responda APENAS com base no conhecimento fornecido abaixo.
Se não souber a resposta ou se ela não estiver na base de conhecimento, diga claramente que não encontrou essa informação na base.
Seja objetivo e direto nas respostas.
Use formatação simples (sem markdown complexo).

BASE DE CONHECIMENTO:
${knowledgeContext}`

    if (isFineTuned) {
      systemPrompt = knowledgeContext
        ? `Você é um assistente de suporte especializado em ${contextName}.
Responda com base no seu conhecimento. Use o contexto adicional abaixo se relevante.
Se não souber a resposta, diga claramente.

CONTEXTO ADICIONAL:
${knowledgeContext}`
        : `Você é um assistente de suporte especializado em ${contextName}.
Responda com base no seu conhecimento. Se não souber a resposta, diga claramente.`
    }

    // --- Call OpenAI ---
    const openai = getOpenAIClient()

    const openaiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    ]

    // Handle streaming
    if (stream) {
      const streamResponse = await openai.chat.completions.create({
        model: selectedModel,
        max_tokens: max_tokens || 2048,
        temperature: temperature ?? (isFineTuned ? 0.3 : undefined),
        messages: openaiMessages,
        stream: true,
      })

      const encoder = new TextEncoder()
      const streamId = `chatcmpl-${Date.now()}`

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamResponse) {
              const delta = chunk.choices[0]?.delta
              const openaiChunk = {
                id: streamId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: selectedModel,
                choices: [
                  {
                    index: 0,
                    delta: {
                      role: delta?.role || undefined,
                      content: delta?.content || '',
                    },
                    finish_reason: chunk.choices[0]?.finish_reason,
                  },
                ],
              }

              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`))
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error) {
            controller.error(error)
          }
        },
      })

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // Non-streaming response
    const response = await openai.chat.completions.create({
      model: selectedModel,
      max_tokens: max_tokens || 2048,
      temperature: temperature ?? (isFineTuned ? 0.3 : undefined),
      messages: openaiMessages,
    })

    const responseText = response.choices[0]?.message?.content
    if (!responseText) {
      return Response.json(
        { error: { message: 'No response from AI', type: 'server_error', code: 'empty_response' } },
        { status: 500 }
      )
    }

    // Return OpenAI-compatible response format
    return Response.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: selectedModel,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: responseText,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      },
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('n8n proxy error:', errMsg)
    return Response.json(
      { error: { message: `Error processing request: ${errMsg}`, type: 'server_error', code: 'internal_error' } },
      { status: 500 }
    )
  }
}
