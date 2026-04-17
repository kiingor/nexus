import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { chatWithKnowledge } from '@/lib/services/chat'
import { ChatMessageSchema } from '@/lib/mcp/schemas'

export function registerChatWithKnowledge(server: McpServer) {
  server.registerTool(
    'chat_with_knowledge',
    {
      title: 'Chat with knowledge base (RAG)',
      description:
        'Envia uma pergunta ao assistente do Nexus. O sistema busca contexto na base (RAG) e responde via LLM. Use quando a resposta precisa ser gerada/sintetizada; para trechos brutos, prefira search_knowledge.',
      inputSchema: {
        message: z.string().min(1).describe('Pergunta do usuário'),
        product_slug: z.string().optional().describe('Slug do produto para filtrar a base'),
        model: z.string().optional().describe('Modelo OpenAI (ex: gpt-4.1-mini). Padrão: gpt-4.1-mini.'),
        history: z
          .array(ChatMessageSchema)
          .optional()
          .describe('Histórico da conversa (mensagens prévias)'),
      },
    },
    async ({ message, product_slug, model, history }) => {
      try {
        const result = await chatWithKnowledge({
          message,
          productSlug: product_slug,
          model,
          history,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { response: result.response, model: result.model, rag: result.rag },
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
