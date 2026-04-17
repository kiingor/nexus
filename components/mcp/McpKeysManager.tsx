'use client'

import { useEffect, useState } from 'react'
import { Key, Plus, Trash2, Copy, Check, AlertTriangle } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { GlassModal } from '@/components/ui/GlassModal'
import { useToast } from '@/components/ui/Toast'

interface KeyRow {
  id: string
  name: string
  prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export function McpKeysManager() {
  const [keys, setKeys] = useState<KeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [revealed, setRevealed] = useState<{ name: string; key: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/mcp/keys')
      const data = await res.json()
      setKeys(Array.isArray(data) ? data : [])
    } catch {
      setKeys([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate() {
    if (!name.trim() || creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/mcp/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Erro ao gerar key', 'error')
        return
      }
      setRevealed({ name: data.name, key: data.key })
      setCreateOpen(false)
      setName('')
      load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao gerar key', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string, name: string) {
    if (!confirm(`Revogar a key "${name}"? Não poderá ser desfeito.`)) return
    const res = await fetch(`/api/mcp/keys/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast('Key revogada', 'success')
      load()
    } else {
      toast('Erro ao revogar', 'error')
    }
  }

  async function copyKey() {
    if (!revealed) return
    await navigator.clipboard.writeText(revealed.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <div className="glass p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-orange-400" />
            <h2 className="text-lg font-display font-bold text-primary">API Keys</h2>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 transition-all cursor-pointer"
          >
            <Plus size={12} /> Gerar nova key
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted py-6 text-center">
            Nenhuma key criada ainda. Clique em &quot;Gerar nova key&quot; para começar.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-glass-border text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-2 py-2 font-medium">Nome</th>
                <th className="px-2 py-2 font-medium">Prefixo</th>
                <th className="px-2 py-2 font-medium">Criada</th>
                <th className="px-2 py-2 font-medium">Último uso</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-glass-border/50">
                  <td className="px-2 py-2.5 text-sm text-primary">{k.name}</td>
                  <td className="px-2 py-2.5 text-sm">
                    <code className="text-xs font-mono text-secondary">{k.prefix}…</code>
                  </td>
                  <td className="px-2 py-2.5 text-xs text-secondary">
                    {new Date(k.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-2 py-2.5 text-xs text-secondary">
                    {k.last_used_at
                      ? new Date(k.last_used_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : <span className="text-muted">nunca</span>}
                  </td>
                  <td className="px-2 py-2.5">
                    {k.revoked_at ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 border border-red-500/25 text-red-400">
                        Revogada
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/10 border border-green-500/25 text-green-400">
                        Ativa
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    {!k.revoked_at && (
                      <button
                        onClick={() => handleRevoke(k.id, k.name)}
                        className="text-muted hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10 cursor-pointer"
                        title="Revogar"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal criar */}
      <GlassModal open={createOpen} onClose={() => !creating && setCreateOpen(false)} title="Gerar nova API key">
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Dê um nome descritivo (ex: &quot;n8n produção&quot;, &quot;Claude Desktop João&quot;).
            O token plaintext será exibido <span className="text-orange-400 font-medium">uma única vez</span> após gerar — copie e guarde.
          </p>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted mb-1.5 block">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={creating}
              placeholder="n8n produção"
              className="w-full px-3 py-2 rounded-xl bg-surface border border-glass-border text-primary text-sm placeholder:text-muted focus:outline-none focus:border-orange-500/50 disabled:opacity-50"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setCreateOpen(false)}
              disabled={creating}
              className="px-4 py-2 rounded-xl text-sm text-secondary hover:text-primary hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {creating ? <><Spinner size="sm" /> Gerando...</> : <><Plus size={14} /> Gerar</>}
            </button>
          </div>
        </div>
      </GlassModal>

      {/* Modal key revelada */}
      <GlassModal
        open={!!revealed}
        onClose={() => setRevealed(null)}
        title="Key gerada"
        className="max-w-xl"
      >
        {revealed && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/25">
              <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-200 leading-relaxed">
                Esta é a única vez que esta key será mostrada. Guarde em um local seguro antes de fechar esta janela — após fechar, não será possível recuperá-la.
              </p>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted mb-1.5 block">
                {revealed.name}
              </label>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-surface border border-glass-border">
                <code className="text-xs text-primary flex-1 break-all font-mono">
                  {revealed.key}
                </code>
                <button
                  onClick={copyKey}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 transition-all cursor-pointer flex-shrink-0"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setRevealed(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </GlassModal>
    </>
  )
}
