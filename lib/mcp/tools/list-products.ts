import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listProducts } from '@/lib/services/products'

export function registerListProducts(server: McpServer) {
  server.registerTool(
    'list_products',
    {
      title: 'List products',
      description:
        'Lista todos os produtos cadastrados no Nexus com contagem de módulos e itens. Use para descobrir os slugs disponíveis antes de chamar outras tools que aceitam product_slug.',
    },
    async () => {
      try {
        const products = await listProducts()
        return {
          content: [{ type: 'text', text: JSON.stringify(products, null, 2) }],
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
