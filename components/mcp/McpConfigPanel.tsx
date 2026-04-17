'use client'

import { useEffect, useState } from 'react'
import { Activity, AlertCircle, Copy, Check, Server } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { McpKeysManager } from './McpKeysManager'
import { McpExamples } from './McpExamples'
import { McpToolsList } from './McpToolsList'

export function McpConfigPanel() {
  const [endpoint, setEndpoint] = useState('')
  const [healthOk, setHealthOk] = useState<boolean | null>(null)
  const [copiedEndpoint, setCopiedEndpoint] = useState(false)

  useEffect(() => {
    const url = `${window.location.origin}/api/mcp/mcp`
    setEndpoint(url)

    fetch('/api/mcp/health')
      .then((r) => setHealthOk(r.ok))
      .catch(() => setHealthOk(false))
  }, [])

  async function copyEndpoint() {
    await navigator.clipboard.writeText(endpoint)
    setCopiedEndpoint(true)
    setTimeout(() => setCopiedEndpoint(false), 1500)
  }

  return (
    <div className="space-y-6">
      {/* Endpoint + health */}
      <div className="glass p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-orange-400" />
            <h2 className="text-lg font-display font-bold text-primary">Endpoint</h2>
          </div>
          <HealthBadge ok={healthOk} />
        </div>

        <div className="flex items-center gap-2 p-3 rounded-xl bg-surface border border-glass-border">
          <code className="text-sm text-primary flex-1 break-all font-mono">
            {endpoint || '—'}
          </code>
          <button
            onClick={copyEndpoint}
            disabled={!endpoint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/10 border border-orange-500/25 text-orange-400 hover:bg-orange-500/20 transition-all cursor-pointer disabled:opacity-40"
          >
            {copiedEndpoint ? <Check size={12} /> : <Copy size={12} />}
            {copiedEndpoint ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        <p className="text-xs text-muted mt-2">
          Transporte: <span className="text-secondary">Streamable HTTP</span> · Auth:{' '}
          <span className="text-secondary">Bearer token</span>
        </p>
      </div>

      {/* Keys manager */}
      <McpKeysManager />

      {/* Tools list */}
      <McpToolsList />

      {/* Examples */}
      <McpExamples endpoint={endpoint} />
    </div>
  )
}

function HealthBadge({ ok }: { ok: boolean | null }) {
  if (ok === null) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-glass border border-glass-border text-muted">
        <Spinner size="sm" /> Verificando
      </div>
    )
  }
  if (ok) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-green-500/10 border border-green-500/25 text-green-400">
        <Activity size={10} /> Online
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-red-500/10 border border-red-500/25 text-red-400">
      <AlertCircle size={10} /> Offline
    </div>
  )
}
