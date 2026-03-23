'use client'

import { useState } from 'react'
import { GlassTextarea } from '@/components/ui/GlassTextarea'
import { GlassInput } from '@/components/ui/GlassInput'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassModal } from '@/components/ui/GlassModal'
import { Spinner } from '@/components/ui/Spinner'
import { InstructionView } from './InstructionView'
import { ErrorView } from './ErrorView'
import type { InstructionContent, ErrorContent } from '@/lib/types'

interface AIGeneratePanelProps {
  open: boolean
  onClose: () => void
  onSave: (data: { title: string; content: InstructionContent | ErrorContent; keywords: string[] }) => Promise<void>
  moduleType: 'instruction' | 'error'
}

export function AIGeneratePanel({ open, onClose, onSave, moduleType }: AIGeneratePanelProps) {
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [generatedContent, setGeneratedContent] = useState<InstructionContent | ErrorContent | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate() {
    if (!prompt.trim()) return
    setGenerating(true)
    setError('')
    setGeneratedContent(null)

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, type: moduleType }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao gerar conteúdo')
        return
      }

      const data = await res.json()
      setTitle(data.title || '')
      setKeywords(data.keywords || [])
      setGeneratedContent(data.content)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!generatedContent || !title) return
    setSaving(true)
    try {
      await onSave({ title, content: generatedContent, keywords })
      setPrompt('')
      setTitle('')
      setKeywords([])
      setGeneratedContent(null)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setPrompt('')
    setTitle('')
    setKeywords([])
    setGeneratedContent(null)
    setError('')
    onClose()
  }

  return (
    <GlassModal
      open={open}
      onClose={handleClose}
      title="Gerar com IA"
      className="max-w-lg"
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <GlassTextarea
          label={
            moduleType === 'instruction'
              ? 'Descreva o processo em linguagem natural'
              : 'Descreva o erro em linguagem natural'
          }
          placeholder={
            moduleType === 'instruction'
              ? 'Ex: Como cadastrar um novo cliente no sistema. O botão fica no menu lateral, na seção Clientes...'
              : 'Ex: Quando o usuário tenta emitir uma nota fiscal, aparece o erro NFE-001 dizendo que o certificado expirou...'
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
        />

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
            {error}
          </p>
        )}

        {!generatedContent ? (
          <GlassButton
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full"
          >
            {generating ? (
              <>
                <Spinner size="sm" />
                Gerando estrutura...
              </>
            ) : (
              'Gerar com IA'
            )}
          </GlassButton>
        ) : (
          <div className="space-y-4">
            <GlassInput
              label="Título"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            {/* Preview visual do conteúdo gerado */}
            <div className="glass p-4">
              <p className="text-xs text-muted uppercase tracking-wider mb-3">Conteúdo gerado</p>
              {generatedContent.type === 'instruction' ? (
                <InstructionView content={generatedContent as InstructionContent} />
              ) : (
                <ErrorView content={generatedContent as ErrorContent} />
              )}
            </div>

            <div className="flex gap-3">
              <GlassButton
                variant="glass"
                onClick={() => setGeneratedContent(null)}
                className="flex-1"
              >
                Gerar Novamente
              </GlassButton>
              <GlassButton
                onClick={handleSave}
                disabled={saving || !title}
                className="flex-1"
              >
                {saving ? 'Salvando...' : 'Salvar no Nexus'}
              </GlassButton>
            </div>
          </div>
        )}
      </div>
    </GlassModal>
  )
}
