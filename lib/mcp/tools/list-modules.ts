import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listModulesByProductSlug } from '@/lib/services/modules'

export function registerListModules(server: McpServer) {
  server.registerTool(
    'list_modules',
    {
      title: 'List modules of a product',
      description:
        'Lista os módulos (agrupamentos de instruções/erros) de um produto específico, incluindo contagem de itens por módulo.',
      inputSchema: {
        product_slug: z.string().describe('Slug do produto. Use list_products para descobrir.'),
      },
    },
    async ({ product_slug }) => {
      try {
        const modules = await listModulesByProductSlug(product_slug)
        return {
          content: [{ type: 'text', text: JSON.stringify(modules, null, 2) }],
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
