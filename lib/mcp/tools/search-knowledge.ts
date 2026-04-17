import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { searchKnowledge } from '@/lib/services/knowledge-search'

export function registerSearchKnowledge(server: McpServer) {
  server.registerTool(
    'search_knowledge',
    {
      title: 'Search knowledge base',
      description:
        'Busca semântica (vector similarity) na base de conhecimento do Nexus. Retorna trechos relevantes ordenados por similaridade. Use para responder perguntas de suporte sem invocar um LLM.',
      inputSchema: {
        query: z.string().min(1).describe('Pergunta ou termo a buscar em linguagem natural'),
        product_slug: z
          .string()
          .optional()
          .describe('Slug do produto para restringir a busca. Ex: "xpro", "matriz". Omitir para buscar em toda a base.'),
        limit: z.number().int().min(1).max(20).default(10).describe('Máximo de resultados (1-20)'),
        match_threshold: z
          .number()
          .min(0)
          .max(1)
          .default(0.65)
          .describe('Similaridade mínima (0-1). Padrão 0.65.'),
      },
    },
    async ({ query, product_slug, limit, match_threshold }) => {
      try {
        const result = await searchKnowledge({
          query,
          productSlug: product_slug,
          limit,
          matchThreshold: match_threshold,
        })

        const payload = {
          used_rag: result.usedRAG,
          product: result.productName,
          matches: result.matches.map((m) => ({
            title: m.item_title,
            chunk: m.chunk_text,
            similarity: Number(m.similarity?.toFixed?.(3) ?? m.similarity),
            module: m.module_name ?? null,
            product: m.product_name ?? null,
          })),
          match_count: result.matches.length,
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          isError: true,
          content: [{ type: 'text', text: `Erro: ${msg}` }],
        }
      }
    }
  )
}
