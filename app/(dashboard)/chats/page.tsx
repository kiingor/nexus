'use client'

import { useState, useEffect, useCallback } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Upload, MessageSquare, Search, ChevronDown, ChevronUp, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react'
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
  const [feedbacks, setFeedbacks] = useState<Record<string, { type: 'positive' | 'negative'; note?: string }>>({})
  const [feedbackSending, setFeedbackSending] = useState<Record<string, boolean>>({})
  const [feedbackNotes, setFeedbackNotes] = useState<Record<string, string>>({})
  const [feedbackOpen, setFeedbackOpen] = useState<Record<string, boolean>>({})
  const [trainAdded, setTrainAdded] = useState<Record<string, 'positive' | 'negative'>>({})
  const [trainOpen, setTrainOpen] = useState<Record<string, boolean>>({})
  const [trainNotes, setTrainNotes] = useState<Record<string, string>>({})
  const [trainType, setTrainType] = useState<Record<string, 'positive' | 'negative'>>({})

  const LS_FEEDBACK_KEY = 'nexus_ticket_feedbacks'

  // Load persisted feedbacks from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_FEEDBACK_KEY)
      if (saved) setFeedbacks(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  // Helper: save a ticket transcript to nexus_sim_training
  function saveTicketToTraining(ticket: Ticket, type: 'positive' | 'negative', note: string) {
    try {
      const msgs = parseChatHistory(ticket.chat_history)
      const transcript = msgs
        .filter(m => m.text.trim())
        .map(m => ({
          role: (m.sender !== ticket.cliente_nome ? 'agent' : 'client') as 'agent' | 'client',
          text: m.text.trim(),
        }))
      if (transcript.length < 2) return
      const existing: Array<{
        id: number; assunto: string; motivo: string;
        feedback: 'positive' | 'negative'; feedbackNote: string;
        transcript: Array<{ role: 'agent' | 'client'; text: string }>; savedAt: string
      }> = JSON.parse(localStorage.getItem('nexus_sim_training') ?? '[]')
      const entryId = ticket.ticket_numero ?? Math.floor(Date.now() / 1000)
      const filtered = existing.filter(e => e.id !== entryId)
      localStorage.setItem('nexus_sim_training', JSON.stringify([...filtered, {
        id: entryId,
        assunto: `${ticket.cliente_nome}${ticket.setor ? ` — ${ticket.setor}` : ''}`,
        motivo: ticket.setor || 'Suporte geral',
        feedback: type,
        feedbackNote: note,
        transcript,
        savedAt: new Date().toISOString(),
      }]))
    } catch { /* ignore */ }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search) params.set('search', search)
      if (filterStatus) params.set('status', filterStatus)
      if (filterCanal) params.set('canal', filterCanal)
      const res = await fetch(`/api/tickets?${params}`)
      const json = await res.json()
      const data: Ticket[] = json.data || []
      setTickets(data)
      setTotal(json.total || 0)
    } finally {
      setLoading(false)
    }
  }, [page, search, filterStatus, filterCanal])

  async function sendFeedback(ticket: Ticket, type: 'positive' | 'negative', note?: string) {
    setFeedbackSending(prev => ({ ...prev, [ticket.ticket_id]: true }))
    try {
      // 1. Persist feedback state to localStorage
      const updated = { ...feedbacks, [ticket.ticket_id]: { type, note } }
      try { localStorage.setItem(LS_FEEDBACK_KEY, JSON.stringify(updated)) } catch { /* ignore */ }

      // 2. Save transcript to nexus_sim_training so it appears in Aprendizado Reforçado
      saveTicketToTraining(ticket, type, note ?? '')

      // 3. Best-effort save to DB
      fetch('/api/tickets/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticket.ticket_id, feedback: type, note: note ?? '' }),
      }).catch(() => {})

      setFeedbacks(updated)
      setFeedbackOpen(prev => ({ ...prev, [ticket.ticket_id]: false }))
      setFeedbackNotes(prev => { const next = { ...prev }; delete next[ticket.ticket_id]; return next })
    } finally {
      setFeedbackSending(prev => ({ ...prev, [ticket.ticket_id]: false }))
    }
  }

  function selectFeedbackType(ticket: Ticket, type: 'positive' | 'negative') {
    setFeedbacks(prev => ({ ...prev, [ticket.ticket_id]: { type, note: prev[ticket.ticket_id]?.note } }))
    setFeedbackOpen(prev => ({ ...prev, [ticket.ticket_id]: true }))
  }

  function addToTraining(ticket: Ticket) {
    const type = trainType[ticket.ticket_id] ?? 'positive'
    const note = trainNotes[ticket.ticket_id]?.trim() ?? ''
    saveTicketToTraining(ticket, type, note)
    setTrainAdded(prev => ({ ...prev, [ticket.ticket_id]: type }))
    setTrainOpen(prev => ({ ...prev, [ticket.ticket_id]: false }))
  }

  useEffect(() => { load() }, [load])

  // When tickets load, import any already-saved feedbacks into nexus_sim_training
  useEffect(() => {
    if (tickets.length === 0) return
    try {
      const savedFeedbacks: Record<string, { type: 'positive' | 'negative'; note?: string }> =
        JSON.parse(localStorage.getItem(LS_FEEDBACK_KEY) ?? '{}')
      const training: Array<{ id: number }> =
        JSON.parse(localStorage.getItem('nexus_sim_training') ?? '[]')
      const trainingIds = new Set(training.map(e => e.id))
      for (const ticket of tickets) {
        const fb = savedFeedbacks[ticket.ticket_id]
        if (fb && !trainingIds.has(ticket.ticket_numero)) {
          saveTicketToTraining(ticket, fb.type, fb.note ?? '')
        }
      }
    } catch { /* ignore */ }
  }, [tickets])

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

                      {/* Usar no treino */}
                      {isSimulable(ticket) && (
                        <div className="mt-3 border border-purple-500/20 rounded-xl p-3 bg-purple-500/5">
                          {trainAdded[ticket.ticket_id] ? (
                            <p className="text-[11px] text-purple-400">
                              ✓ Adicionado ao treino como exemplo {trainAdded[ticket.ticket_id] === 'positive' ? 'positivo' : 'negativo (correção)'}
                            </p>
                          ) : trainOpen[ticket.ticket_id] ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-secondary">Tipo:</span>
                                <button
                                  onClick={() => setTrainType(prev => ({ ...prev, [ticket.ticket_id]: 'positive' }))}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${(trainType[ticket.ticket_id] ?? 'positive') === 'positive' ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-glass border-glass-border text-secondary'}`}>
                                  <ThumbsUp size={11} /> Positivo
                                </button>
                                <button
                                  onClick={() => setTrainType(prev => ({ ...prev, [ticket.ticket_id]: 'negative' }))}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${trainType[ticket.ticket_id] === 'negative' ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-glass border-glass-border text-secondary'}`}>
                                  <ThumbsDown size={11} /> Negativo
                                </button>
                              </div>
                              <textarea
                                rows={2}
                                value={trainNotes[ticket.ticket_id] ?? ''}
                                onChange={e => setTrainNotes(prev => ({ ...prev, [ticket.ticket_id]: e.target.value }))}
                                placeholder={trainType[ticket.ticket_id] === 'negative' ? 'O que o atendente fez de errado? (ajuda no treino)' : 'O que foi bom neste atendimento? (opcional)'}
                                className="w-full px-3 py-2 rounded-xl bg-glass border border-glass-border text-primary text-xs focus:outline-none focus:border-purple-500/50 resize-none placeholder:text-muted"
                              />
                              <div className="flex items-center justify-between">
                                <button onClick={() => setTrainOpen(prev => ({ ...prev, [ticket.ticket_id]: false }))}
                                  className="text-[11px] text-muted hover:text-secondary transition-all">Cancelar</button>
                                <button onClick={() => addToTraining(ticket)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/15 border border-purple-500/25 text-purple-300 hover:bg-purple-500/25 transition-all">
                                  Confirmar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] text-purple-300/70">Usar este chat como exemplo de treinamento</p>
                              <button
                                onClick={() => { setTrainType(prev => ({ ...prev, [ticket.ticket_id]: 'positive' })); setTrainOpen(prev => ({ ...prev, [ticket.ticket_id]: true })) }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-purple-500/15 border border-purple-500/25 text-purple-300 hover:bg-purple-500/25 transition-all">
                                + Adicionar ao treino
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Feedback */}
                      <div className="mt-3 border border-glass-border rounded-xl p-3 bg-black/10">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-muted">Este atendimento foi bom para treinar a IA?</p>
                          <div className="flex items-center gap-2">
                            <button
                              disabled={feedbackSending[ticket.ticket_id]}
                              onClick={() => selectFeedbackType(ticket, 'positive')}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${feedbacks[ticket.ticket_id]?.type === 'positive' ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-glass border-glass-border text-secondary hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-400'}`}>
                              <ThumbsUp size={13} /> Bom
                            </button>
                            <button
                              disabled={feedbackSending[ticket.ticket_id]}
                              onClick={() => selectFeedbackType(ticket, 'negative')}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${feedbacks[ticket.ticket_id]?.type === 'negative' ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-glass border-glass-border text-secondary hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'}`}>
                              <ThumbsDown size={13} /> Ruim
                            </button>
                          </div>
                        </div>

                        {/* Justificativa — aparece após selecionar */}
                        {feedbackOpen[ticket.ticket_id] && (
                          <div className="mt-3 space-y-2">
                            <label className="text-[11px] text-secondary">
                              Justificativa <span className="text-muted">(opcional — ajuda no treinamento)</span>
                            </label>
                            <textarea
                              rows={3}
                              value={feedbackNotes[ticket.ticket_id] ?? feedbacks[ticket.ticket_id]?.note ?? ''}
                              onChange={e => setFeedbackNotes(prev => ({ ...prev, [ticket.ticket_id]: e.target.value }))}
                              placeholder="Ex: A IA resolveu corretamente o problema de NF-e sem precisar abrir chamado..."
                              className="w-full px-3 py-2 rounded-xl bg-glass border border-glass-border text-primary text-xs focus:outline-none focus:border-orange-500/50 resize-none placeholder:text-muted"
                            />
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] px-2 py-0.5 rounded border ${feedbacks[ticket.ticket_id]?.type === 'positive' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                {feedbacks[ticket.ticket_id]?.type === 'positive' ? '👍 Positivo' : '👎 Negativo'}
                              </span>
                              <button
                                disabled={feedbackSending[ticket.ticket_id]}
                                onClick={() => sendFeedback(ticket, feedbacks[ticket.ticket_id]!.type, feedbackNotes[ticket.ticket_id] ?? feedbacks[ticket.ticket_id]?.note)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/15 border border-orange-500/25 text-orange-400 hover:bg-orange-500/25 transition-all disabled:opacity-50">
                                {feedbackSending[ticket.ticket_id] ? 'Salvando...' : 'Salvar avaliação'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Confirmação de salvo */}
                        {!feedbackOpen[ticket.ticket_id] && feedbacks[ticket.ticket_id]?.type && (
                          <p className="mt-2 text-[10px] text-muted">
                            {feedbacks[ticket.ticket_id]?.note
                              ? `Avaliação salva · "${feedbacks[ticket.ticket_id]!.note!.slice(0, 60)}${feedbacks[ticket.ticket_id]!.note!.length > 60 ? '…' : ''}"`
                              : 'Avaliação salva — adicione uma justificativa para enriquecer o treinamento'}
                          </p>
                        )}
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
