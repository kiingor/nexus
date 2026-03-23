'use client'

import { useState, useEffect, useRef } from 'react'
import { GlassInput } from '@/components/ui/GlassInput'
import { GlassTextarea } from '@/components/ui/GlassTextarea'
import { GlassButton } from '@/components/ui/GlassButton'
import { cn } from '@/lib/utils'
import type { KnowledgeItem, InstructionStep, InstructionContent, ErrorContent } from '@/lib/types'

interface KnowledgeItemFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { title: string; content: InstructionContent | ErrorContent; keywords: string[] }) => Promise<void>
  moduleType: 'instruction' | 'error'
  item?: KnowledgeItem | null
}

function cleanStep(step: InstructionStep): InstructionStep {
  return {
    passo: step.passo,
    acao: step.acao,
    orientacao: step.orientacao || null,
    atalho: step.atalho || null,
  }
}

export function KnowledgeItemForm({ open, onClose, onSubmit, moduleType, item }: KnowledgeItemFormProps) {
  const [title, setTitle] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [loading, setLoading] = useState(false)

  // Instruction fields
  const [steps, setSteps] = useState<InstructionStep[]>([])
  const [currentAcao, setCurrentAcao] = useState('')
  const [currentOrientacao, setCurrentOrientacao] = useState('')
  const [currentAtalho, setCurrentAtalho] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // Error fields
  const [errorCode, setErrorCode] = useState('')
  const [description, setDescription] = useState('')
  const [cause, setCause] = useState('')
  const [solution, setSolution] = useState('')
  const [orientation, setOrientation] = useState('')

  const acaoInputRef = useRef<HTMLInputElement>(null)
  const stepsListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    if (item) {
      setTitle(item.title)
      setKeywords(item.keywords || [])
      if (item.type === 'instruction') {
        const c = item.content as InstructionContent
        setSteps(c.steps.length > 0 ? [...c.steps] : [])
      } else {
        const c = item.content as ErrorContent
        setErrorCode(c.error_code || '')
        setDescription(c.description)
        setCause(c.cause)
        setSolution(c.solution)
        setOrientation(c.orientation || '')
      }
    } else {
      setTitle('')
      setKeywords([])
      setSteps([])
      setErrorCode('')
      setDescription('')
      setCause('')
      setSolution('')
      setOrientation('')
    }
    setCurrentAcao('')
    setCurrentOrientacao('')
    setCurrentAtalho('')
    setEditingIndex(null)
  }, [item, open])

  function handleAddStep() {
    if (!currentAcao.trim()) return

    const newStep: InstructionStep = {
      passo: editingIndex !== null ? steps[editingIndex].passo : steps.length + 1,
      acao: currentAcao.trim(),
      orientacao: currentOrientacao.trim() || null,
      atalho: currentAtalho.trim() || null,
    }

    if (editingIndex !== null) {
      const updated = [...steps]
      updated[editingIndex] = newStep
      setSteps(updated)
      setEditingIndex(null)
    } else {
      setSteps([...steps, newStep])
    }

    setCurrentAcao('')
    setCurrentOrientacao('')
    setCurrentAtalho('')

    // Focus back on acao input
    setTimeout(() => {
      acaoInputRef.current?.focus()
      stepsListRef.current?.scrollTo({ top: stepsListRef.current.scrollHeight, behavior: 'smooth' })
    }, 50)
  }

  function handleEditStep(index: number) {
    const step = steps[index]
    setCurrentAcao(step.acao)
    setCurrentOrientacao(step.orientacao || '')
    setCurrentAtalho(step.atalho || '')
    setEditingIndex(index)
    acaoInputRef.current?.focus()
  }

  function handleRemoveStep(index: number) {
    const updated = steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, passo: i + 1 }))
    setSteps(updated)
    if (editingIndex === index) {
      setEditingIndex(null)
      setCurrentAcao('')
      setCurrentOrientacao('')
      setCurrentAtalho('')
    }
  }

  function handleMoveStep(index: number, direction: 'up' | 'down') {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === steps.length - 1) return

    const updated = [...steps]
    const target = direction === 'up' ? index - 1 : index + 1
    ;[updated[index], updated[target]] = [updated[target], updated[index]]

    setSteps(updated.map((s, i) => ({ ...s, passo: i + 1 })))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && currentAcao.trim()) {
      e.preventDefault()
      handleAddStep()
    }
  }

  async function handleSubmit() {
    if (!title.trim()) return
    setLoading(true)
    try {
      let content: InstructionContent | ErrorContent

      if (moduleType === 'instruction') {
        if (steps.length === 0) return
        content = { type: 'instruction', steps: steps.map(cleanStep) }
      } else {
        content = {
          type: 'error',
          error_code: errorCode || null,
          description,
          cause,
          solution,
          orientation: orientation || null,
        }
      }

      await onSubmit({ title, content, keywords })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-base flex flex-col">
      {/* Header */}
      <div className="border-b border-glass-border px-6 py-4 flex items-center justify-between bg-surface">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary transition-colors cursor-pointer flex items-center gap-2 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Voltar
          </button>
          <div className="h-5 w-px bg-glass-border" />
          <h1 className="text-lg font-display font-bold text-primary">
            {item ? 'Editar Item' : 'Novo Item'}
          </h1>
        </div>

        <GlassButton
          onClick={handleSubmit}
          disabled={loading || !title.trim() || (moduleType === 'instruction' && steps.length === 0)}
        >
          {loading ? 'Salvando...' : 'Salvar no Nexus'}
        </GlassButton>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Title - always visible */}
        <div className="px-6 py-4 border-b border-glass-border">
          <GlassInput
            label="Título do item"
            placeholder={moduleType === 'instruction' ? 'Ex: Como realizar uma venda no PDV' : 'Ex: Erro ao emitir nota fiscal'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          {/* Keywords */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-secondary mb-1.5">
              Palavras-chave
            </label>
            <div className="flex gap-2">
              <input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && keywordInput.trim()) {
                    e.preventDefault()
                    setKeywords([...keywords, keywordInput.trim()])
                    setKeywordInput('')
                  }
                }}
                placeholder="Digite e pressione Enter para adicionar"
                className="flex-1 px-4 py-2 rounded-xl bg-glass border border-glass-border text-primary placeholder:text-muted text-sm focus:outline-none focus:border-orange-500/50 transition-all"
              />
              <GlassButton
                type="button"
                variant="glass"
                size="sm"
                disabled={!keywordInput.trim()}
                onClick={() => {
                  if (keywordInput.trim()) {
                    setKeywords([...keywords, keywordInput.trim()])
                    setKeywordInput('')
                  }
                }}
              >
                +
              </GlassButton>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {keywords.map((kw, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => setKeywords(keywords.filter((_, j) => j !== i))}
                      className="hover:text-red-400 transition-colors cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {moduleType === 'instruction' ? (
          /* INSTRUCTION: Two-column layout */
          <div className="flex flex-1 h-[calc(100vh-10rem)]">
            {/* Left column: Add step form */}
            <div className="w-1/2 border-r border-glass-border p-6 flex flex-col">
              <div className="mb-4">
                <h2 className="text-sm font-medium text-secondary mb-1">
                  {editingIndex !== null
                    ? `Editando Passo ${editingIndex + 1}`
                    : `Adicionar Passo ${steps.length + 1}`}
                </h2>
                <p className="text-xs text-muted">
                  Preencha a ação e pressione Enter ou clique em Adicionar
                </p>
              </div>

              <div className="space-y-3 flex-1">
                <GlassInput
                  ref={acaoInputRef}
                  label="Ação"
                  placeholder="O que o usuário deve fazer neste passo"
                  value={currentAcao}
                  onChange={(e) => setCurrentAcao(e.target.value)}
                  onKeyDown={handleKeyDown}
                />

                <GlassInput
                  label="Orientação visual (opcional)"
                  placeholder="Onde encontrar o elemento na tela"
                  value={currentOrientacao}
                  onChange={(e) => setCurrentOrientacao(e.target.value)}
                  onKeyDown={handleKeyDown}
                />

                <GlassInput
                  label="Atalho de teclado (opcional)"
                  placeholder="Ex: F1, Ctrl+S"
                  value={currentAtalho}
                  onChange={(e) => setCurrentAtalho(e.target.value)}
                  onKeyDown={handleKeyDown}
                />

                <GlassButton
                  onClick={handleAddStep}
                  disabled={!currentAcao.trim()}
                  className="w-full"
                  variant={editingIndex !== null ? 'glass' : 'primary'}
                >
                  {editingIndex !== null ? 'Atualizar Passo' : '+ Adicionar Passo'}
                </GlassButton>

                {editingIndex !== null && (
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setEditingIndex(null)
                      setCurrentAcao('')
                      setCurrentOrientacao('')
                      setCurrentAtalho('')
                    }}
                  >
                    Cancelar edição
                  </GlassButton>
                )}
              </div>
            </div>

            {/* Right column: Steps list */}
            <div className="w-1/2 p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-secondary">
                  Passos cadastrados
                </h2>
                <span className="text-xs text-muted">
                  {steps.length} {steps.length === 1 ? 'passo' : 'passos'}
                </span>
              </div>

              {steps.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="mx-auto mb-3 text-muted">
                      <path d="M10 10h20v20H10z" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
                      <path d="M20 15v10M15 20h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <p className="text-sm text-muted">Nenhum passo adicionado</p>
                    <p className="text-xs text-muted mt-1">Adicione passos no formulário ao lado</p>
                  </div>
                </div>
              ) : (
                <div ref={stepsListRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {steps.map((step, i) => (
                    <div
                      key={`${step.passo}-${i}`}
                      className={cn(
                        'glass p-3 group transition-all duration-200',
                        editingIndex === i && 'glow-orange'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Step number */}
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center mt-0.5">
                          <span className="text-xs font-bold text-orange-400">{step.passo}</span>
                        </div>

                        {/* Step content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-primary font-medium">{step.acao}</p>
                          {step.orientacao && (
                            <p className="text-xs text-secondary mt-0.5">{step.orientacao}</p>
                          )}
                          {step.atalho && (
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-mono bg-surface border border-glass-border rounded text-muted">
                              {step.atalho}
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleMoveStep(i, 'up')}
                            disabled={i === 0}
                            className="p-1 text-muted hover:text-primary disabled:opacity-30 transition-colors cursor-pointer"
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M6 2v8M3 5l3-3 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleMoveStep(i, 'down')}
                            disabled={i === steps.length - 1}
                            className="p-1 text-muted hover:text-primary disabled:opacity-30 transition-colors cursor-pointer"
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M6 10V2M3 7l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEditStep(i)}
                            className="p-1 text-muted hover:text-orange-400 transition-colors cursor-pointer"
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z" stroke="currentColor" strokeWidth="1.2" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleRemoveStep(i)}
                            className="p-1 text-muted hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ERROR: Single column form */
          <div className="max-w-2xl mx-auto p-6 space-y-4">
            <GlassInput
              label="Código do Erro (opcional)"
              placeholder="Ex: PDV-001"
              value={errorCode}
              onChange={(e) => setErrorCode(e.target.value)}
            />
            <GlassTextarea
              label="Descrição"
              placeholder="O que o erro significa para o usuário"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
            />
            <GlassTextarea
              label="Causa"
              placeholder="Por que esse erro acontece"
              value={cause}
              onChange={(e) => setCause(e.target.value)}
              rows={3}
              required
            />
            <GlassTextarea
              label="Solução"
              placeholder="Como resolver passo a passo"
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              rows={4}
              required
            />
            <GlassInput
              label="Orientação visual (opcional)"
              placeholder="Onde o erro aparece na tela"
              value={orientation}
              onChange={(e) => setOrientation(e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
