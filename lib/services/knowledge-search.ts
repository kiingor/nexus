import { createServerClient } from '@/lib/supabase/server'
import { generateQueryEmbedding } from '@/lib/embeddings'
import { buildRAGContext, type RAGMatch } from '@/lib/rag-context'
import type { InstructionContent, ErrorContent } from '@/lib/types'

export interface KnowledgeMatch {
  item_id: string
  chunk_type: 'item_full' | 'step' | 'error_full'
  step_number: number | null
  item_title: string
  chunk_text: string
  similarity: number
  module_name?: string | null
  product_name?: string | null
}

export interface SearchKnowledgeParams {
  query: string
  productSlug?: string
  limit?: number
  /** @deprecated kept for backward compatibility; no longer applied */
  matchThreshold?: number
}

function toKnowledgeMatch(row: RAGMatch): KnowledgeMatch {
  return {
    item_id: row.metadata.item_id,
    chunk_type: row.metadata.chunk_type,
    step_number: row.metadata.step_number,
    item_title: row.metadata.item_title,
    chunk_text: row.content,
    similarity: row.similarity,
    module_name: row.metadata.module_name ?? null,
    product_name: row.metadata.product_name ?? null,
  }
}

export interface SearchKnowledgeResult {
  matches: KnowledgeMatch[]
  productId: string | null
  productName: string | null
  usedRAG: boolean
  fallbackContext: string
}

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

/**
 * Resolve productSlug to id/name. Returns null id for "todos os produtos".
 */
async function resolveProduct(productSlug: string | undefined) {
  if (!productSlug) return { id: null, name: null as string | null }
  const supabase = createServerClient()
  const { data } = await supabase
    .from('products')
    .select('id, name')
    .eq('slug', productSlug)
    .single()
  if (!data) throw new Error(`Produto não encontrado: ${productSlug}`)
  return { id: data.id as string, name: data.name as string }
}

/**
 * Core RAG search. Tries vector similarity first; if productSlug given and
 * no local matches, falls back to global vector search. If no matches at all,
 * builds a plain-text context from all active items (full fallback).
 */
export async function searchKnowledge(
  params: SearchKnowledgeParams
): Promise<SearchKnowledgeResult> {
  const { query, productSlug } = params
  const limit = params.limit ?? 10

  const { id: productId, name: productName } = await resolveProduct(productSlug)

  const supabase = createServerClient()

  let matches: KnowledgeMatch[] = []
  let ragRows: RAGMatch[] = []
  let usedRAG = false

  try {
    const queryEmbedding = await generateQueryEmbedding(query)

    const { data: ragMatches, error } = await supabase.rpc('match_items_openai', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_count: limit,
      filter: productId ? { product_id: productId } : {},
    })

    if (!error && ragMatches && ragMatches.length > 0) {
      ragRows = ragMatches as RAGMatch[]
      matches = ragRows.map(toKnowledgeMatch)
      usedRAG = true
    } else if (productId) {
      const { data: globalMatches, error: gErr } = await supabase.rpc('match_items_openai', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_count: limit,
        filter: {},
      })
      if (!gErr && globalMatches && globalMatches.length > 0) {
        ragRows = globalMatches as RAGMatch[]
        matches = ragRows.map(toKnowledgeMatch)
        usedRAG = true
      }
    }
  } catch (err) {
    console.warn('[knowledge-search] RAG failed, falling back:', err)
  }

  let fallbackContext = ''

  if (usedRAG) {
    fallbackContext = buildRAGContext(ragRows)
  } else {
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

    fallbackContext = buildKnowledgeContext(
      (items || []).map((i) => ({
        ...i,
        modules: (i as Record<string, unknown> & { modules: { name: string } }).modules,
      }))
    )
  }

  return { matches, productId, productName, usedRAG, fallbackContext }
}
