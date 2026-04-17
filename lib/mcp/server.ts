import { createMcpHandler } from 'mcp-handler'
import { registerSearchKnowledge } from './tools/search-knowledge'
import { registerChatWithKnowledge } from './tools/chat-with-knowledge'
import { registerListProducts } from './tools/list-products'
import { registerListModules } from './tools/list-modules'
import { registerCreateKnowledgeItem } from './tools/create-knowledge-item'

export const handler = createMcpHandler(
  (server) => {
    registerSearchKnowledge(server)
    registerChatWithKnowledge(server)
    registerListProducts(server)
    registerListModules(server)
    registerCreateKnowledgeItem(server)
  },
  {
    serverInfo: { name: 'nexus-mcp', version: '0.1.0' },
  },
  {
    basePath: '/api/mcp',
    maxDuration: 300,
    verboseLogs: process.env.NODE_ENV !== 'production',
  }
)
