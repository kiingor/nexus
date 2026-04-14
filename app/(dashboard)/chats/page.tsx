'use client'

import { useState, useEffect, useCallback } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Upload, MessageSquare, Search, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Ticket {
  id: string
  ticket_id: string
  ticket_numero: number
  ticket_status: string
  ticket_canal: string
  ticket_prioridade: string
  setor: string
  atendente: string
  cliente_nome: string
  cliente_cnpj: string
  cliente_telefone: string
  duracao_total: string
  tempo_primeira_resposta: string
  total_mensagens: number
  mensagens_cliente: number
  mensagens_colaborador: number
  has_audio: boolean
  has_imagem: boolean
  criado_em: string
  encerrado_em: string
  chat_history: string
}

function parseChatHistory(raw: string): Array<{ ts: string; sender: string; text: string }> {
  if (!raw) return []
  const lines = raw.split('\n').filter(Boolean)
  const msgs: Array<{ ts: string; sender: string; text: string }> = []
  const lineRx = /^\[(.+?)\] ([^:]+): (.*)$/

  let current: { ts: string; sender: string; text: string } | null = null

  for (const line of lines) {
    const m = line.match(lineRx)
    if (m) {
      if (current) msgs.push(current)
      current = {
        ts: m[1],
        sender: m[2].replace(/\*.*?\*\n?/, '').trim(),
        text: m[3].replace(/\*.*?\*:?\s*/, '').trim(),
      }
    } else if (current) {
      current.text += '\n' + line.trim()
    }
  }
  if (current) msgs.push(current)
  return msgs
}

function statusColor(s: string) {
  if (s === 'encerrado') return 'bg-green-500/10 text-green-400 border-green-500/20'
  if (s === 'aberto') return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  if (s === 'pendente') return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  return 'bg-white/5 text-secondary border-white/10'
}

export default function ChatsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCanal, setFilterCanal] = useState('')
  const [onlySimulable, setOnlySimulable] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search) params.set('search', search)
      if (filterStatus) params.set('status', filterStatus)
      if (filterCanal) params.set('canal', filterCanal)
      const res = await fetch(`/api/tickets?${params}`)
      const json = await res.json()
      setTickets(json.data || [])
      setTotal(json.total || 0)
    } finally {
      setLoading(false)
    }
  }, [page, search, filterStatus, filterCanal])

  useEffect(() => { load() }, [load])

  async function handleImport(file: File) {
    setImporting(true)
    setImportResult(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
      const data = await res.json()
      if (res.ok) {
        setImportResult(`✓ ${data.imported} tickets importados`)
        load()
      } else {
        setImportResult(`Erro: ${data.error}`)
      }
    } catch (e) {
      setImportResult('Erro ao ler arquivo JSON')
    } finally {
      setImporting(false)
    }
  }

  function isSimulable(ticket: Ticket): boolean {
    return !!(ticket.chat_history?.trim()) && (ticket.mensagens_cliente ?? 0) > 0
  }

  function sendToSimulate(ticket: Ticket) {
    const conv = {
      id: ticket.ticket_numero,
      assunto: `${ticket.cliente_nome} — ${ticket.setor}`,
      conv: ticket.chat_history || '',
      motivo: ticket.setor || 'Suporte geral',
      cnpj: ticket.cliente_cnpj || '',
    }
    sessionStorage.setItem('nexus_sim_import', JSON.stringify([conv]))
    router.push('/simulate')
  }

  const totalPages = Math.ceil(total / 50)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary">Chats Monitorados</h1>
          <p className="text-secondary mt-1 text-sm">{total} tickets importados</p>
        </div>
        <div className="flex items-center gap-3">
          <label className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all border ${importing ? 'opacity-50 pointer-events-none' : 'bg-orange-500/10 border-orange-500/25 text-orange-400 hover:bg-orange-500/20'}`}>
            <input type="file" accept=".json" className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
            {importing ? <Spinner size="sm" /> : <Upload size={15} />}
            Importar JSON
          </label>
          <Button variant="secondary" size="sm" onClick={load}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {importResult && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm border ${importResult.startsWith('✓') ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {importResult}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar cliente, CNPJ, atendente..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-glass border border-glass-border text-primary text-sm focus:outline-none focus:border-orange-500/50 placeholder:text-muted" />
        </div>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-xl bg-glass border border-glass-border text-secondary text-sm focus:outline-none focus:border-orange-500/50">
          <option value="">Todos os status</option>
          <option value="encerrado">Encerrado</option>
          <option value="aberto">Aberto</option>
          <option value="pendente">Pendente</option>
        </select>
        <select value={filterCanal} onChange={e => { setFilterCanal(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-xl bg-glass border border-glass-border text-secondary text-sm focus:outline-none focus:border-orange-500/50">
          <option value="">Todos os canais</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
          <option value="telefone">Telefone</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer select-none px-3 py-2 rounded-xl bg-glass border border-glass-border hover:border-orange-500/30 transition-all">
          <input type="checkbox" checked={onlySimulable} onChange={e => setOnlySimulable(e.target.checked)}
            className="rounded border-glass-border accent-orange-500" />
          Apenas simuláveis
        </label>
      </div>

      {/* Table */}
      <GlassCard>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted gap-3">
            <MessageSquare size={40} className="opacity-20" />
            <p className="text-sm">Nenhum ticket encontrado. Importe um arquivo JSON.</p>
          </div>
        ) : (
          <div>
            {tickets.filter(t => !onlySimulable || isSimulable(t)).map(ticket => {
              const expanded = expandedId === ticket.id
              const msgs = expanded ? parseChatHistory(ticket.chat_history) : []
              const canSimulate = isSimulable(ticket)

              return (
                <div key={ticket.id} className="border-b border-glass-border last:border-0">
                  {/* Row */}
                  <div className="flex items-center gap-3 px-5 py-3 hover:bg-glass-hover transition-all">
                    <div className="flex-1 min-w-0 grid grid-cols-[auto_1fr_1fr_1fr_auto_auto] gap-4 items-center">
                      {/* Ticket # */}
                      <span className="text-xs font-mono text-muted w-14">#{ticket.ticket_numero}</span>

                      {/* Cliente */}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{ticket.cliente_nome}</p>
                        <p className="text-[10px] text-muted font-mono">{ticket.cliente_cnpj}</p>
                      </div>

                      {/* Atendente + setor */}
                      <div className="min-w-0">
                        <p className="text-xs text-secondary truncate">{ticket.atendente}</p>
                        <p className="text-[10px] text-muted truncate">{ticket.setor}</p>
                      </div>

                      {/* Métricas */}
                      <div>
                        <p className="text-xs text-secondary">{ticket.duracao_total}</p>
                        <p className="text-[10px] text-muted">{ticket.total_mensagens} msgs</p>
                      </div>

                      {/* Status + canal */}
                      <div className="flex flex-col gap-1 items-end">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${statusColor(ticket.ticket_status)}`}>
                          {ticket.ticket_status}
                        </span>
                        <span className="text-[10px] text-muted">{ticket.ticket_canal}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      {canSimulate ? (
                        <button onClick={() => sendToSimulate(ticket)}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-all whitespace-nowrap">
                          Simular
                        </button>
                      ) : (
                        <span className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 border border-white/10 text-muted whitespace-nowrap" title="Sem histórico de chat suficiente">
                          Sem chat
                        </span>
                      )}
                      <button onClick={() => setExpandedId(expanded ? null : ticket.id)}
                        className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-glass transition-all">
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded chat */}
                  {expanded && (
                    <div className="px-5 pb-5">
                      <div className="rounded-xl bg-black/20 border border-glass-border p-4 max-h-96 overflow-y-auto space-y-3">
                        {msgs.length === 0 ? (
                          <p className="text-xs text-muted text-center py-4">Sem histórico de chat</p>
                        ) : msgs.map((m, i) => {
                          const isAgent = m.sender !== ticket.cliente_nome
                          return (
                            <div key={i} className={`flex gap-2.5 ${isAgent ? '' : 'flex-row-reverse'}`}>
                              <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] mt-0.5 ${isAgent ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-blue-500/20 border border-blue-500/30'}`}>
                                {isAgent ? '🎧' : '👤'}
                              </div>
                              <div className={`max-w-[70%] flex flex-col gap-0.5 ${isAgent ? '' : 'items-end'}`}>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-medium ${isAgent ? 'text-orange-400/70' : 'text-blue-400/70'}`}>{m.sender}</span>
                                  <span className="text-[9px] text-muted">{m.ts}</span>
                                </div>
                                <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${isAgent ? 'bg-white/5 border border-white/8 text-primary rounded-tl-sm' : 'bg-blue-500/10 border border-blue-500/20 text-blue-100 rounded-tr-sm'}`}>
                                  {m.text}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </GlassCard>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="text-xs text-muted">{page} / {totalPages}</span>
          <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próximo</Button>
        </div>
      )}
    </div>
  )
}
