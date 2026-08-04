'use client'

import { useState, useEffect } from 'react'
import { GlassInput } from '@/components/ui/GlassInput'
import { GlassTextarea } from '@/components/ui/GlassTextarea'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassModal } from '@/components/ui/GlassModal'
import { slugify } from '@/lib/utils'
import type { Product, ProductAudience } from '@/lib/types'

interface ProductFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    name: string
    description: string
    slug: string
    audience: ProductAudience
  }) => Promise<void>
  product?: Product | null
}

export function ProductForm({ open, onClose, onSubmit, product }: ProductFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [slug, setSlug] = useState('')
  // Público-alvo do produto. Default 'cliente' (caso mais comum).
  const [audience, setAudience] = useState<ProductAudience>('cliente')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (product) {
      setName(product.name)
      setDescription(product.description || '')
      setSlug(product.slug)
      setAudience(product.audience ?? 'cliente')
    } else {
      setName('')
      setDescription('')
      setSlug('')
      setAudience('cliente')
    }
  }, [product, open])

  useEffect(() => {
    if (!product) {
      setSlug(slugify(name))
    }
  }, [name, product])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit({ name, description, slug, audience })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={product ? 'Editar Produto' : 'Novo Produto'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <GlassInput
          label="Nome"
          placeholder="Nome do produto"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-secondary">Slug</label>
          <p className="text-xs text-muted bg-surface rounded-xl px-4 py-2.5 font-mono">
            {slug || 'gerado-automaticamente'}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-secondary">
            Público-alvo
          </label>
          <p className="text-xs text-muted">
            Define para quem é o conteúdo deste produto. O agente de IA usa isso
            para buscar só os procedimentos do público certo.
          </p>
          <div className="inline-flex rounded-xl border border-glass-border overflow-hidden mt-1">
            {(['cliente', 'tecnico'] as const).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => setAudience(op)}
                className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  audience === op
                    ? 'bg-orange-500/15 text-orange-400'
                    : 'text-secondary hover:text-primary hover:bg-white/5'
                } ${op === 'tecnico' ? 'border-l border-glass-border' : ''}`}
              >
                {op === 'cliente' ? 'Cliente' : 'Técnico'}
              </button>
            ))}
          </div>
        </div>

        <GlassTextarea
          label="Descrição (opcional)"
          placeholder="Breve descrição do produto"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div className="flex gap-3 pt-2">
          <GlassButton type="button" variant="glass" onClick={onClose} className="flex-1">
            Cancelar
          </GlassButton>
          <GlassButton type="submit" disabled={loading || !name} className="flex-1">
            {loading ? 'Salvando...' : product ? 'Salvar' : 'Criar Produto'}
          </GlassButton>
        </div>
      </form>
    </GlassModal>
  )
}
