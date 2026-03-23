'use client'

import { useState, useEffect } from 'react'
import { GlassInput } from '@/components/ui/GlassInput'
import { GlassTextarea } from '@/components/ui/GlassTextarea'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassModal } from '@/components/ui/GlassModal'
import { cn } from '@/lib/utils'
import type { Module } from '@/lib/types'

interface ModuleFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { name: string; type: 'instruction' | 'error'; description: string; keywords: string[] }) => Promise<void>
  module?: Module | null
}

export function ModuleForm({ open, onClose, onSubmit, module }: ModuleFormProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'instruction' | 'error'>('instruction')
  const [description, setDescription] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (module) {
      setName(module.name)
      setType(module.type)
      setDescription(module.description || '')
      setKeywords(module.keywords || [])
    } else {
      setName('')
      setType('instruction')
      setDescription('')
      setKeywords([])
    }
    setKeywordInput('')
  }, [module, open])

  function addKeyword() {
    if (keywordInput.trim()) {
      setKeywords([...keywords, keywordInput.trim()])
      setKeywordInput('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit({ name, type, description, keywords })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={module ? 'Editar Módulo' : 'Novo Módulo'}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <GlassInput
          label="Nome"
          placeholder="Nome do módulo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-secondary">Tipo</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('instruction')}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer',
                type === 'instruction'
                  ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400'
                  : 'bg-glass border border-glass-border text-secondary hover:text-primary'
              )}
            >
              Instrução
            </button>
            <button
              type="button"
              onClick={() => setType('error')}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer',
                type === 'error'
                  ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                  : 'bg-glass border border-glass-border text-secondary hover:text-primary'
              )}
            >
              Erro
            </button>
          </div>
        </div>

        <GlassTextarea
          label="Descrição (opcional)"
          placeholder="Breve descrição do módulo"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        {/* Keywords */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-secondary">
            Palavras-chave
          </label>
          <p className="text-xs text-muted">
            Frases que o usuário diria ao buscar este assunto
          </p>
          <div className="flex gap-2">
            <input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addKeyword()
                }
              }}
              placeholder="Digite e pressione Enter"
              className="flex-1 px-4 py-2 rounded-xl bg-glass border border-glass-border text-primary placeholder:text-muted text-sm focus:outline-none focus:border-orange-500/50 transition-all"
            />
            <GlassButton
              type="button"
              variant="glass"
              size="sm"
              disabled={!keywordInput.trim()}
              onClick={addKeyword}
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

        <div className="flex gap-3 pt-2">
          <GlassButton type="button" variant="glass" onClick={onClose} className="flex-1">
            Cancelar
          </GlassButton>
          <GlassButton type="submit" disabled={loading || !name} className="flex-1">
            {loading ? 'Salvando...' : module ? 'Salvar' : 'Criar Módulo'}
          </GlassButton>
        </div>
      </form>
    </GlassModal>
  )
}
