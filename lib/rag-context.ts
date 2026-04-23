export interface RAGMatchMetadata {
  item_id: string
  item_title: string
  chunk_type: 'item_full' | 'step' | 'error_full'
  step_number: number | null
  module_name?: string | null
  product_name?: string | null
}

export interface RAGMatch {
  id: string
  content: string
  metadata: RAGMatchMetadata
  similarity: number
}

/**
 * Join RAG matches into a single context string.
 *
 * Assumes the caller used `match_items_openai`, which returns one row per
 * item (always the `item_full`/`error_full` chunk).
 */
export function buildRAGContext(matches: RAGMatch[]): string {
  if (!matches || matches.length === 0) return ''
  return matches.map((m) => m.content).join('\n\n---\n\n')
}
