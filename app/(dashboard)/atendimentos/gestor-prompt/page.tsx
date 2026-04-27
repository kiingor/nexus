'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Sparkles,
  CheckSquare,
  Square,
  Wand2,
  Copy,
  Check,
  Filter,
  AlertCircle,
} from 'lucide-react'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Spinner } from '@/components/ui/Spinner'
import type { AtendimentoRecord } from '@/lib/types'
import type { PromptSuggestion } from './types'

const CATEGORY_LABEL: Record<PromptSuggestion['categoria'], string> = {
  cobertura: 'Cobertura',
  tom: 'Tom',
  roteiro: 'Roteiro',
  erro_comum: 'Erro comum',
  extracao: 'Extração',
  outro: 'Outro',
}

const CATEGORY_COLOR: Record<PromptSuggestion['categoria'], string> = {
  cobertura: 'bg-blue-500/10 border-blue-500/25 text-blue-400',
  tom: 'bg-purple-500/10 border-purple-500/25 text-purple-400',
  roteiro: 'bg-orange-500/10 border-orange-500/25 text-orange-400',
  erro_comum: 'bg-red-500/10 border-red-500/25 text-red-400',
  extracao: 'bg-green-500/10 border-green-500/25 text-green-400',
  outro: 'bg-glass border-glass-border text-secondary',
}

export default function GestorPromptPage() {
  const [currentPrompt, setCurrentPrompt] = useState('')

  const [records, setRecords] = useState<AtendimentoRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([])
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())

  const [updatedPrompt, setUpdatedPrompt] = useState('')
  const [copied, setCopied] = useState(false)

  // ── Carregar atendimentos ──────────────────────────────────────────────
  const loadRecords = useCallback(async () => {
    setLoadingRecords(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/atendimentos?${params.toString()}`)
      const data = await res.json()
      setRecords(Array.isArray(data) ? data : [])
    } catch {
      setRecords([])
    } finally {
      setLoadingRecords(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return records
    return records.filter((r) =>
      [r.nome_empresa, r.cnpj, r.phone, r.cliente_nome, r.problema_relatado, r.id_ligacao, r.id]
        .filter((v) => v != null && v !== '')
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [records, search])

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      filteredRecords.forEach((r) => next.add(r.id))
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  // ── Gerar sugestões ────────────────────────────────────────────────────
  async function generate() {
    setError(null)
    setSuggestions([])
    setAppliedIds(new Set())
    setUpdatedPrompt('')

    if (!currentPrompt.trim()) {
      setError('Cole o prompt atual antes de gerar sugestões.')
      return
    }
    if (selectedIds.size === 0) {
      setError('Selecione ao menos 1 atendimento.')
      return
    }

    setGenerating(true)
    try {
      const res = await fetch('/api/atendimentos/gestor-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPrompt,
          atendimentoIds: Array.from(selectedIds),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'Erro ao gerar sugestões')
        return
      }
      const list: PromptSuggestion[] = Array.isArray(data?.suggestions) ? data.suggestions : []
      setSuggestions(list)
      // Por padrão, todas começam marcadas
      setAppliedIds(new Set(list.map((s) => s.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar sugestões')
    } finally {
      setGenerating(false)
    }
  }

  function toggleApply(id: string) {
    setAppliedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Aplicar sugestões selecionadas ────────────────────────────────────
  const previewUpdatedPrompt = useMemo(() => {
    if (suggestions.length === 0) return ''
    const aplicadas = suggestions.filter((s) => appliedIds.has(s.id))
    if (aplicadas.length === 0) return currentPrompt

    const inicio = aplicadas
      .filter((s) => s.posicao_sugerida === 'inicio')
      .map((s) => s.trecho_a_adicionar.trim())
      .join('\n\n')

    const fim = aplicadas
      .filter((s) => s.posicao_sugerida !== 'inicio')
      .map(
        (s) =>
          `## ${s.titulo}\n${s.trecho_a_adicionar.trim()}`
      )
      .join('\n\n')

    return [inicio, currentPrompt.trim(), fim].filter(Boolean).join('\n\n')
  }, [suggestions, appliedIds, currentPrompt])

  function applyToOutput() {
    setUpdatedPrompt(previewUpdatedPrompt)
  }

  function adoptAsCurrent() {
    if (!updatedPrompt) return
    setCurrentPrompt(updatedPrompt)
    setUpdatedPrompt('')
    setSuggestions([])
    setAppliedIds(new Set())
  }

  async function copyUpdated() {
    if (!updatedPrompt) return
    try {
      await navigator.clipboard.writeText(updatedPrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Atendimentos', href: '/atendimentos' },
          { label: 'Gestor de Prompt' },
        ]}
      />

      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/atendimentos"
            className="text-muted hover:text-primary transition-colors"
            title="Voltar"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold text-primary flex items-center gap-2">
              <Sparkles size={24} className="text-orange-400" />
              Gestor de Prompt
            </h1>
            <p className="text-secondary mt-1">
              Selecione atendimentos, gere sugestões e atualize seu prompt da Renata.
            </p>
          </div>
        </div>
      </div>

      {/* Step 1 — Prompt atual */}
      <div className="glass p-5 mb-5">
        <h2 className="text-xs uppercase tracking-wider text-muted mb-3">
          1. Prompt atual
        </h2>
        <textarea
          value={currentPrompt}
          onChange={(e) => setCurrentPrompt(e.target.value)}
          placeholder="Cole aqui o system prompt atual da Renata (VAPI/OpenAI)..."
          rows={10}
          className="w-full bg-glass border border-glass-border rounded-xl px-3 py-2 text-sm text-primary outline-none focus:border-orange-500/40 placeholder:text-muted font-mono"
        />
        <p className="text-[11px] text-muted mt-2">
          {currentPrompt.length.toLocaleString('pt-BR')} caracteres
        </p>
      </div>

      {/* Step 2 — Atendimentos */}
      <div className="glass p-5 mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="text-xs uppercase tracking-wider text-muted">
            2. Atendimentos selecionados ({selectedIds.size})
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllVisible}
              disabled={filteredRecords.length === 0}
              className="text-xs text-muted hover:text-primary underline underline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Selecionar todos visíveis
            </button>
            <span className="text-muted">·</span>
            <button
              type="button"
              onClick={clearSelection}
              disabled={selectedIds.size === 0}
              className="text-xs text-muted hover:text-primary underline underline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Limpar seleção
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-2 text-muted text-xs uppercase tracking-wider">
            <Filter size={14} />
            Filtros
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-glass border border-glass-border rounded-xl px-3 py-1.5 text-sm text-primary outline-none focus:border-orange-500/40"
          >
            <option value="all">Todos status</option>
            <option value="em_atendimento">Em atendimento</option>
            <option value="transferida">Transferida</option>
            <option value="resolvida_ia">Resolvida IA</option>
            <option value="interrompida">Interrompida</option>
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empresa, CNPJ, telefone, ID..."
            className="flex-1 min-w-[220px] bg-glass border border-glass-border rounded-xl px-3 py-1.5 text-sm text-primary outline-none focus:border-orange-500/40 placeholder:text-muted"
          />
        </div>

        <div className="border border-glass-border rounded-xl overflow-hidden max-h-[360px] overflow-y-auto">
          {loadingRecords ? (
            <div className="py-10 flex justify-center">
              <Spinner size="md" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted">
              Nenhum atendimento encontrado.
            </div>
          ) : (
            <ul className="divide-y divide-glass-border">
              {filteredRecords.map((r) => {
                const checked = selectedIds.has(r.id)
                return (
                  <li
                    key={r.id}
                    onClick={() => toggleSelect(r.id)}
                    className={`flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                      checked ? 'bg-orange-500/5' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <span
                      className={`mt-0.5 ${checked ? 'text-orange-400' : 'text-muted'}`}
                    >
                      {checked ? <CheckSquare size={16} /> : <Square size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap text-sm">
                        <span className="text-primary font-medium truncate max-w-[260px]">
                          {r.nome_empresa || '—'}
                        </span>
                        <span className="text-[11px] uppercase tracking-wider text-muted">
                          #{r.id} · {r.status ?? '—'}
                          {r.destino ? ` · ${r.destino}` : ''}
                        </span>
                      </div>
                      {r.problema_relatado && (
                        <p className="text-xs text-secondary truncate">
                          {r.problema_relatado}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Step 3 — Generate */}
      <div className="flex items-center justify-end gap-3 mb-5">
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-400">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={generate}
          disabled={generating || selectedIds.size === 0 || !currentPrompt.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors text-sm font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {generating ? <Spinner size="sm" /> : <Sparkles size={14} />}
          {generating ? 'Analisando...' : 'Gerar sugestões'}
        </button>
      </div>

      {/* Step 4 — Suggestions */}
      {suggestions.length > 0 && (
        <div className="glass p-5 mb-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <h2 className="text-xs uppercase tracking-wider text-muted">
              3. Sugestões ({appliedIds.size}/{suggestions.length} marcadas)
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAppliedIds(new Set(suggestions.map((s) => s.id)))}
                className="text-xs text-muted hover:text-primary underline underline-offset-2"
              >
                Marcar todas
              </button>
              <span className="text-muted">·</span>
              <button
                type="button"
                onClick={() => setAppliedIds(new Set())}
                className="text-xs text-muted hover:text-primary underline underline-offset-2"
              >
                Desmarcar todas
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {suggestions.map((s) => {
              const checked = appliedIds.has(s.id)
              return (
                <div
                  key={s.id}
                  className={`border rounded-xl p-4 transition-colors ${
                    checked
                      ? 'border-orange-500/30 bg-orange-500/5'
                      : 'border-glass-border bg-glass'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleApply(s.id)}
                      className={`mt-0.5 cursor-pointer ${
                        checked ? 'text-orange-400' : 'text-muted hover:text-primary'
                      }`}
                      aria-label="Selecionar sugestão"
                    >
                      {checked ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${CATEGORY_COLOR[s.categoria] ?? CATEGORY_COLOR.outro}`}
                        >
                          {CATEGORY_LABEL[s.categoria] ?? s.categoria}
                        </span>
                        <span className="text-[10px] text-muted uppercase tracking-wider">
                          {s.posicao_sugerida === 'inicio'
                            ? '→ Início do prompt'
                            : s.posicao_sugerida === 'secao_existente'
                              ? '→ Complementa seção'
                              : '→ Fim do prompt'}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-primary mb-1">{s.titulo}</h3>
                      <p className="text-xs text-secondary mb-2">{s.insight}</p>
                      <pre className="text-xs text-primary bg-base/50 border border-glass-border rounded-lg p-2.5 whitespace-pre-wrap font-mono leading-relaxed">
                        {s.trecho_a_adicionar}
                      </pre>
                      {s.exemplo_atendimento && (
                        <p className="text-[10px] text-muted mt-1.5">
                          Baseado em: {s.exemplo_atendimento}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={applyToOutput}
              disabled={appliedIds.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Wand2 size={14} />
              Gerar prompt atualizado
            </button>
          </div>
        </div>
      )}

      {/* Step 5 — Updated prompt */}
      {updatedPrompt && (
        <div className="glass p-5 mb-10 border-l-2 border-orange-500/40">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <h2 className="text-xs uppercase tracking-wider text-muted">
              4. Prompt atualizado
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyUpdated}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                  copied
                    ? 'bg-green-500/10 border-green-500/25 text-green-400'
                    : 'bg-glass border-glass-border text-muted hover:text-primary hover:border-orange-500/40'
                }`}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
              <button
                type="button"
                onClick={adoptAsCurrent}
                className="text-xs text-orange-400 hover:text-orange-300 underline underline-offset-2"
              >
                Usar como prompt atual ↑
              </button>
            </div>
          </div>
          <pre className="text-xs text-primary bg-base/50 border border-glass-border rounded-xl p-3 whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-y-auto">
            {updatedPrompt}
          </pre>
          <p className="text-[11px] text-muted mt-2">
            {updatedPrompt.length.toLocaleString('pt-BR')} caracteres ·{' '}
            {appliedIds.size} sugestões aplicadas
          </p>
        </div>
      )}
    </div>
  )
}
