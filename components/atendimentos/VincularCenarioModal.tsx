'use client'

import { useEffect, useRef, useState } from 'react'
import { GlassModal } from '@/components/ui/GlassModal'
import { Spinner } from '@/components/ui/Spinner'
import { Search, Check, Pin, X } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'

interface KnowledgeItemResult {
  id: string
  title: string
  type: 'instruction' | 'error'
  module_id: string
  modules?: {
    id: string
    name: string
    products?: { id: string; name: string; slug: string } | null
  } | null
}

interface Props {
  open: boolean
  onClose: () => void
  /**
   * Texto a ser vinculado. Aparece num textarea editável (o usuário pode
   * refinar antes de salvar). É o texto que vai virar embedding em
   * knowledge_embeddings.
   */
  messageText: string
  /** Atendimento de origem (rastreabilidade). */
  atendimentoId: number
  /** Índice da mensagem na transcrição (rastreabilidade, opcional).
   * Use null pra "conversa inteira". */
  messageIndex?: number | null
  speaker?: string | null
  /**
   * Modo de vinculação. Muda só rótulos e dicas — a persistência é igual.
   *  - 'message' (default): vinculando UMA mensagem específica do cliente
   *  - 'conversation': vinculando a conversa toda (várias falas do cliente concatenadas)
   */
  mode?: 'message' | 'conversation'
  /** Callback após vincular com sucesso — passa o item vinculado. */
  onLinked?: (item: KnowledgeItemResult) => void
}

export function VincularCenarioModal({
  open,
  onClose,
  messageText,
  atendimentoId,
  messageIndex,
  speaker,
  mode = 'message',
  onLinked,
}: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<KnowledgeItemResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Texto editável — o usuário pode refinar antes de salvar.
  // Útil principalmente no modo 'conversation' onde a concatenação pode
  // ter "lixo" (digitação confusa, repetições) que vale limpar.
  const [text, setText] = useState(messageText)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Reset estado quando abre/fecha. Quando abre, pré-carrega lista
  // sem busca (cenários mais "alfabéticos" no topo) e foca o input.
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedId(null)
      setError(null)
      setText(messageText)
      void load('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, messageText])

  // Debounce da busca
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => void load(query), 300)
    return () => clearTimeout(t)
  }, [query, open])

  async function load(q: string) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      params.set('limit', '15')
      const r = await fetch(`/api/knowledge-items/search?${params.toString()}`)
      const j = await r.json()
      if (r.ok) setResults((j.items as KnowledgeItemResult[]) ?? [])
      else setResults([])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  async function vincular() {
    if (!selectedId) return
    const finalText = text.trim()
    if (!finalText) {
      setError('Texto vazio — adicione conteúdo antes de vincular')
      return
    }
    setSaving(true)
    setError(null)
    try {
      // Pega email do usuário autenticado pra registrar como created_by
      const sess = await getSupabaseClient().auth.getSession()
      const createdBy = sess.data.session?.user.email ?? null

      const r = await fetch(`/api/knowledge-items/${selectedId}/examples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageText: finalText,
          sourceAtendimentoId: atendimentoId,
          sourceMessageIndex: messageIndex ?? null,
          // 'conversa-inteira' marca explicitamente que veio do botão de
          // vincular conversa toda, pra diferenciar das mensagens unitárias
          // no painel de "Mensagens vinculadas".
          sourceSpeaker: mode === 'conversation' ? 'conversa-inteira' : (speaker ?? 'cliente'),
          createdBy,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error ?? 'Falha ao vincular')

      const linked = results.find((x) => x.id === selectedId)
      if (linked) onLinked?.(linked)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const modalTitle = mode === 'conversation'
    ? 'Vincular conversa a cenário'
    : 'Vincular mensagem a cenário'
  const sourceLabel = mode === 'conversation'
    ? `Conversa completa (atendimento #${atendimentoId})`
    : `Mensagem do cliente (atendimento #${atendimentoId})`
  const editHint = mode === 'conversation'
    ? 'Pode editar pra tirar ruído (saudações, repetições) e deixar só o que importa pra busca semântica.'
    : 'Pode editar se quiser ajustar a frase exata que vai pro embedding.'

  return (
    <GlassModal open={open} onClose={onClose} title={modalTitle} className="max-w-2xl">
      <div className="space-y-4">
        {/* Texto fonte — editável */}
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-secondary mb-1.5">
            <Pin size={12} />
            {sourceLabel}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={mode === 'conversation' ? 8 : 3}
            className="w-full px-3 py-2 rounded-xl bg-base border border-glass-border text-primary text-sm focus:outline-none focus:border-orange-500/50 placeholder:text-secondary resize-y font-mono leading-relaxed"
          />
          <p className="text-[10px] text-secondary mt-1">{editHint}</p>
        </div>

        {/* Busca */}
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-secondary mb-1.5">
            Buscar cenário existente
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex: cadastro de funcionário, emissão de NFC-e..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-base border border-glass-border text-primary text-sm focus:outline-none focus:border-orange-500/50 placeholder:text-secondary"
            />
          </div>
        </div>

        {/* Resultados */}
        <div className="border border-glass-border rounded-xl divide-y divide-glass-border/50 max-h-72 overflow-y-auto bg-base/40">
          {loading ? (
            <div className="flex justify-center py-6"><Spinner size="sm" /></div>
          ) : results.length === 0 ? (
            <p className="text-xs text-secondary text-center py-6">
              Nenhum cenário encontrado{query ? ` para "${query}"` : ''}.
            </p>
          ) : (
            results.map((it) => {
              const isActive = selectedId === it.id
              const moduleLabel = it.modules?.name ?? 'sem módulo'
              const productLabel = it.modules?.products?.name ?? 'sem produto'
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setSelectedId(it.id)}
                  className={`w-full text-left px-4 py-2.5 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-orange-500/10 border-l-2 border-orange-500/60'
                      : 'hover:bg-white/5 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isActive && <Check size={12} className="text-orange-400 shrink-0" />}
                    <p className="text-sm text-primary font-medium truncate">{it.title}</p>
                  </div>
                  <p className="text-[11px] text-secondary mt-0.5">
                    {productLabel} → {moduleLabel} · {it.type === 'instruction' ? 'Instrução' : 'Erro'}
                  </p>
                </button>
              )
            })
          )}
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Ações */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-glass-border">
          <a
            href="/products"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-secondary hover:text-primary underline underline-offset-2"
          >
            Não achei: criar cenário ↗
          </a>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-sm px-3 py-1.5 rounded-lg border border-glass-border bg-glass text-secondary hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!selectedId || saving}
              onClick={vincular}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/40 text-orange-300 hover:bg-orange-500/25 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Spinner size="sm" /> : <Pin size={13} />}
              {saving ? 'Vinculando…' : 'Vincular'}
            </button>
          </div>
        </div>

        <p className="text-[10px] text-secondary">
          A frase será adicionada ao vector store (knowledge_embeddings) como exemplo do
          cenário escolhido. O agente IA passa a reconhecer variações similares
          automaticamente — sem mudanças no n8n.
        </p>

        {/* Helper interno: tipo único do close button da X bem visível */}
        <button type="button" onClick={onClose} className="hidden">
          <X size={1} />
        </button>
      </div>
    </GlassModal>
  )
}
