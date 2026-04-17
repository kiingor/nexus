'use client'

import { useState } from 'react'
import { Copy, Check, BookOpen } from 'lucide-react'

interface Props {
  endpoint: string
}

export function McpExamples({ endpoint }: Props) {
  const [tab, setTab] = useState<'n8n' | 'claude' | 'curl'>('n8n')

  const url = endpoint || 'https://seu-dominio.com/api/mcp/mcp'

  const examples = {
    n8n: {
      title: 'n8n (MCP Client Tool)',
      lang: 'json',
      text: JSON.stringify(
        {
          'Server URL': url,
          Transport: 'Streamable HTTP',
          Headers: {
            Authorization: 'Bearer SUA_API_KEY_AQUI',
          },
        },
        null,
        2
      ),
    },
    claude: {
      title: 'Claude Desktop (claude_desktop_config.json)',
      lang: 'json',
      text: JSON.stringify(
        {
          mcpServers: {
            nexus: {
              url,
              transport: 'streamable-http',
              headers: {
                Authorization: 'Bearer SUA_API_KEY_AQUI',
              },
            },
          },
        },
        null,
        2
      ),
    },
    curl: {
      title: 'curl (teste manual)',
      lang: 'bash',
      text: `# 1) Initialize (recebe serverInfo)
curl -N -X POST ${url} \\
  -H "Authorization: Bearer SUA_API_KEY_AQUI" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'

# 2) Listar tools
curl -N -X POST ${url} \\
  -H "Authorization: Bearer SUA_API_KEY_AQUI" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3) Buscar conhecimento
curl -N -X POST ${url} \\
  -H "Authorization: Bearer SUA_API_KEY_AQUI" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_knowledge","arguments":{"query":"emitir nota fiscal","product_slug":"softshop","limit":3}}}'`,
    },
  }

  const current = examples[tab]
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(current.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen size={18} className="text-orange-400" />
        <h2 className="text-lg font-display font-bold text-primary">Exemplos de configuração</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {(['n8n', 'claude', 'curl'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              tab === t
                ? 'bg-orange-500/15 border border-orange-500/30 text-orange-400'
                : 'bg-glass border border-glass-border text-secondary hover:text-primary'
            }`}
          >
            {t === 'n8n' ? 'n8n' : t === 'claude' ? 'Claude Desktop' : 'curl'}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted mb-2">{current.title}</p>

      <div className="relative">
        <button
          onClick={copy}
          className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 transition-all cursor-pointer"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        <pre className="text-xs font-mono text-secondary whitespace-pre-wrap p-4 rounded-xl bg-surface border border-glass-border leading-relaxed overflow-x-auto max-h-96">
          {current.text}
        </pre>
      </div>

      <p className="text-[11px] text-muted mt-2">
        Troque <code className="text-orange-400">SUA_API_KEY_AQUI</code> pela key gerada acima.
      </p>
    </div>
  )
}
