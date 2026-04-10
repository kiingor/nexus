import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface InstructionStep {
  passo: number
  acao: string
  orientacao: string | null
  atalho: string | null
}

interface InstructionContent {
  type: 'instruction'
  steps: InstructionStep[]
}

interface ErrorContent {
  type: 'error'
  error_code: string | null
  description: string
  cause: string
  solution: string
  orientation: string | null
}

type KnowledgeContent = InstructionContent | ErrorContent

interface Chunk {
  item_id: string
  chunk_type: 'item_full' | 'step' | 'error_full'
  step_number: number | null
  chunk_text: string
}

// ---------------------------------------------------------------------------
// Clients (lazy init)
// ---------------------------------------------------------------------------
let openai: OpenAI | null = null
let gemini: GoogleGenerativeAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openai
}

function getGemini(): GoogleGenerativeAI | null {
  if (!gemini && process.env.GEMINI_API_KEY) {
    gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  }
  return gemini
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ---------------------------------------------------------------------------
// Build text chunks from a knowledge item
// ---------------------------------------------------------------------------
function buildChunks(
  item: { id: string; title: string; content: KnowledgeContent; keywords?: string[] },
  moduleName: string,
  productName: string
): Chunk[] {
  const chunks: Chunk[] = []
  const keywords = item.keywords?.length ? `Keywords: ${item.keywords.join(', ')}` : ''

  if (item.content.type === 'instruction') {
    const content = item.content as InstructionContent

    const stepsText = content.steps
      .map(s => {
        let text = `Passo ${s.passo}: ${s.acao}`
        if (s.orientacao) text += ` | Orientação: ${s.orientacao}`
        if (s.atalho) text += ` | Atalho: ${s.atalho}`
        return text
      })
      .join('\n')

    chunks.push({
      item_id: item.id,
      chunk_type: 'item_full',
      step_number: null,
      chunk_text: `Produto: ${productName}\nMódulo: ${moduleName}\nInstrução: ${item.title}\n${keywords}\n\n${stepsText}`.trim(),
    })

    for (const step of content.steps) {
      let text = `Produto: ${productName} | Módulo: ${moduleName} | Instrução: ${item.title}\n`
      text += `Passo ${step.passo}: ${step.acao}`
      if (step.orientacao) text += `\nOrientação: ${step.orientacao}`
      if (step.atalho) text += `\nAtalho: ${step.atalho}`

      chunks.push({
        item_id: item.id,
        chunk_type: 'step',
        step_number: step.passo,
        chunk_text: text.trim(),
      })
    }
  } else if (item.content.type === 'error') {
    const content = item.content as ErrorContent

    let text = `Produto: ${productName}\nMódulo: ${moduleName}\nErro: ${item.title}\n${keywords}`
    if (content.error_code) text += `\nCódigo: ${content.error_code}`
    text += `\nDescrição: ${content.description}`
    text += `\nCausa: ${content.cause}`
    text += `\nSolução: ${content.solution}`
    if (content.orientation) text += `\nOrientação: ${content.orientation}`

    chunks.push({
      item_id: item.id,
      chunk_type: 'error_full',
      step_number: null,
      chunk_text: text.trim(),
    })
  }

  return chunks
}

// ---------------------------------------------------------------------------
// Generate embeddings
// ---------------------------------------------------------------------------
async function getOpenAIEmbedding(text: string): Promise<number[]> {
  const res = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return res.data[0].embedding
}

async function getGeminiEmbedding(text: string): Promise<number[] | null> {
  const client = getGemini()
  if (!client) return null
  const model = client.getGenerativeModel({ model: 'gemini-embedding-001' })
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    outputDimensionality: 768,
  } as Parameters<typeof model.embedContent>[0])
  return result.embedding.values
}

// ---------------------------------------------------------------------------
// Query embedding (for RAG search)
// ---------------------------------------------------------------------------

/**
 * Generate an embedding for a search query.
 * Used by the chat endpoint to perform vector similarity search.
 */
export async function generateQueryEmbedding(text: string): Promise<number[]> {
  return getOpenAIEmbedding(text)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate (or regenerate) embeddings for a knowledge item.
 * Call after creating or updating an item.
 */
export async function syncItemEmbeddings(itemId: string): Promise<void> {
  const supabase = getSupabase()

  // Fetch the item with module and product info
  const { data: item, error: itemError } = await supabase
    .from('knowledge_items')
    .select('*, modules(name, products(name))')
    .eq('id', itemId)
    .single()

  if (itemError || !item) {
    console.error('[embeddings] Item not found:', itemId, itemError?.message)
    return
  }

  const moduleName = item.modules?.name || 'Unknown'
  const productName = item.modules?.products?.name || 'Unknown'

  // Delete existing embeddings for this item
  await supabase
    .from('knowledge_embeddings')
    .delete()
    .eq('item_id', itemId)

  // Build chunks and generate embeddings
  const chunks = buildChunks(item, moduleName, productName)

  for (const chunk of chunks) {
    try {
      const [embeddingOpenai, embeddingGemini] = await Promise.all([
        getOpenAIEmbedding(chunk.chunk_text),
        getGeminiEmbedding(chunk.chunk_text),
      ])

      const row: Record<string, unknown> = {
        item_id: chunk.item_id,
        chunk_type: chunk.chunk_type,
        step_number: chunk.step_number,
        chunk_text: chunk.chunk_text,
        embedding_openai: JSON.stringify(embeddingOpenai),
      }

      if (embeddingGemini) {
        row.embedding_gemini = JSON.stringify(embeddingGemini)
      }

      await supabase.from('knowledge_embeddings').insert(row)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[embeddings] Error generating embedding for "${chunk.chunk_type}":`, message)
    }
  }
}

/**
 * Delete all embeddings for a knowledge item.
 * Call after deleting an item.
 */
export async function deleteItemEmbeddings(itemId: string): Promise<void> {
  const supabase = getSupabase()
  await supabase
    .from('knowledge_embeddings')
    .delete()
    .eq('item_id', itemId)
}
