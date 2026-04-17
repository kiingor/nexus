import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createKnowledgeItem } from '@/lib/services/knowledge-items'
import { KnowledgeContentSchema } from '@/lib/mcp/schemas'
import type { InstructionContent, ErrorContent } from '@/lib/types'

export function registerCreateKnowledgeItem(server: McpServer) {
  server.registerTool(
    'create_knowledge_item',
    {
      title: 'Create knowledge item',
      description:
        'Cria um item de conhecimento (instrução ou erro) em um módulo de um produto. Dispara geração de embeddings em background. Use para alimentar a base a partir de tickets resolvidos ou novas FAQs.',
      inputSchema: {
        product_slug: z.string().describe('Slug do produto (use list_products)'),
        module_id: z.string().uuid().describe('UUID do módulo (use list_modules)'),
        title: z.string().min(1).describe('Título do item'),
        type: z.enum(['instruction', 'error']).describe('Tipo: instrução ou erro'),
        content: KnowledgeContentSchema.describe(
          'Conteúdo estruturado. Para instruction: { type:"instruction", steps:[{passo,acao,...}] }. Para error: { type:"error", description, cause, solution, ... }'
        ),
        keywords: z.array(z.string()).default([]).describe('Palavras-chave para busca'),
      },
    },
    async ({ product_slug, module_id, title, type, content, keywords }) => {
      try {
        const item = await createKnowledgeItem({
          productSlug: product_slug,
          moduleId: module_id,
          title,
          type,
          content: content as InstructionContent | ErrorContent,
          keywords,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: item.id,
                  module_id: item.module_id,
                  title: item.title,
                  type: item.type,
                  embedding_sync: 'queued',
                },
                null,
                2
              ),
            },
          ],
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
