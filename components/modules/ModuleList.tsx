'use client'

import { useState, useEffect, useCallback } from 'react'
import { ModuleCard } from './ModuleCard'
import { ModuleForm } from './ModuleForm'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassModal } from '@/components/ui/GlassModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import type { ModuleWithCount, Product } from '@/lib/types'

interface ModuleListProps {
  productSlug: string
}

export function ModuleList({ productSlug }: ModuleListProps) {
  const { toast } = useToast()
  const [product, setProduct] = useState<Product | null>(null)
  const [modules, setModules] = useState<ModuleWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<ModuleWithCount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ModuleWithCount | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [productRes, modulesRes] = await Promise.all([
        fetch(`/api/products/${productSlug}`),
        fetch(`/api/products/${productSlug}/modules`),
      ])

      if (productRes.ok) setProduct(await productRes.json())
      if (modulesRes.ok) setModules(await modulesRes.json())
    } catch {
      toast('Erro ao carregar dados', 'error')
    } finally {
      setLoading(false)
    }
  }, [productSlug, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleCreate(data: { name: string; type: 'instruction' | 'error'; description: string; keywords: string[] }) {
    const res = await fetch(`/api/products/${productSlug}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      toast('Módulo criado!')
      fetchData()
    } else {
      toast('Erro ao criar módulo', 'error')
    }
  }

  async function handleEdit(data: { name: string; type: 'instruction' | 'error'; description: string; keywords: string[] }) {
    if (!editingModule) return
    const res = await fetch(`/api/products/${productSlug}/modules/${editingModule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      toast('Módulo atualizado!')
      setEditingModule(null)
      fetchData()
    } else {
      toast('Erro ao atualizar módulo', 'error')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/products/${productSlug}/modules/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast('Módulo excluído!')
        setDeleteTarget(null)
        fetchData()
      } else {
        toast('Erro ao excluir módulo', 'error')
      }
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary">
            {product?.name || productSlug}
          </h1>
          {product?.description && (
            <p className="text-secondary mt-1">{product.description}</p>
          )}
        </div>
        <GlassButton onClick={() => setFormOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Novo Módulo
        </GlassButton>
      </div>

      {modules.length === 0 ? (
        <EmptyState
          title="Nenhum módulo cadastrado"
          description="Crie módulos para organizar o conhecimento deste produto em categorias."
          actionLabel="Criar Módulo"
          onAction={() => setFormOpen(true)}
          icon={
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="6" y="6" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="2" />
              <path d="M18 18h12M18 24h12M18 30h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {modules.map((mod) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              productSlug={productSlug}
              onEdit={(m) => {
                setEditingModule(m)
                setFormOpen(true)
              }}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <ModuleForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingModule(null)
        }}
        onSubmit={editingModule ? handleEdit : handleCreate}
        module={editingModule}
      />

      <GlassModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir Módulo"
      >
        <p className="text-secondary mb-6">
          Tem certeza que deseja excluir <strong className="text-primary">{deleteTarget?.name}</strong>?
          Todos os itens deste módulo serão removidos.
        </p>
        <div className="flex gap-3">
          <GlassButton variant="glass" onClick={() => setDeleteTarget(null)} className="flex-1">
            Cancelar
          </GlassButton>
          <GlassButton variant="danger" onClick={handleDelete} disabled={deleting} className="flex-1">
            {deleting ? 'Excluindo...' : 'Excluir'}
          </GlassButton>
        </div>
      </GlassModal>
    </>
  )
}
