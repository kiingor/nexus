'use client'

import { useState, useEffect, useCallback } from 'react'
import { KnowledgeItemCard } from './KnowledgeItemCard'
import { KnowledgeItemForm } from './KnowledgeItemForm'
import { AIGeneratePanel } from './AIGeneratePanel'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassModal } from '@/components/ui/GlassModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import type { KnowledgeItem, Module, InstructionContent, ErrorContent } from '@/lib/types'

interface KnowledgeItemListProps {
  productSlug: string
  moduleId: string
}

export function KnowledgeItemList({ productSlug, moduleId }: KnowledgeItemListProps) {
  const { toast } = useToast()
  const [module, setModule] = useState<Module | null>(null)
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [manualFormOpen, setManualFormOpen] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [moduleRes, itemsRes] = await Promise.all([
        fetch(`/api/products/${productSlug}/modules/${moduleId}`),
        fetch(`/api/products/${productSlug}/knowledge?moduleId=${moduleId}`),
      ])

      if (moduleRes.ok) setModule(await moduleRes.json())
      if (itemsRes.ok) setItems(await itemsRes.json())
    } catch {
      toast('Erro ao carregar dados', 'error')
    } finally {
      setLoading(false)
    }
  }, [productSlug, moduleId, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleSave(data: { title: string; content: InstructionContent | ErrorContent; keywords?: string[] }) {
    const res = await fetch(`/api/products/${productSlug}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        module_id: moduleId,
        type: module?.type || 'instruction',
      }),
    })

    if (res.ok) {
      toast('Item criado com sucesso!')
      fetchData()
    } else {
      toast('Erro ao criar item', 'error')
    }
  }

  async function handleEdit(data: { title: string; content: InstructionContent | ErrorContent; keywords?: string[] }) {
    if (!editingItem) return
    const res = await fetch(`/api/products/${productSlug}/knowledge/${editingItem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      toast('Item atualizado!')
      setEditingItem(null)
      fetchData()
    } else {
      toast('Erro ao atualizar item', 'error')
    }
  }

  async function handleToggleActive(item: KnowledgeItem) {
    const res = await fetch(`/api/products/${productSlug}/knowledge/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.is_active }),
    })

    if (res.ok) {
      toast(item.is_active ? 'Item desativado' : 'Item ativado', 'info')
      fetchData()
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/products/${productSlug}/knowledge/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast('Item excluído!')
        setDeleteTarget(null)
        fetchData()
      } else {
        toast('Erro ao excluir item', 'error')
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
            {module?.name || 'Módulo'}
          </h1>
          {module?.description && (
            <p className="text-secondary mt-1">{module.description}</p>
          )}
        </div>

        <div className="relative">
          <GlassButton onClick={() => setAddMenuOpen(!addMenuOpen)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Adicionar Item
          </GlassButton>

          {addMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-20 glass p-2 min-w-[200px]">
                <button
                  onClick={() => {
                    setAddMenuOpen(false)
                    setAiPanelOpen(true)
                  }}
                  className="w-full px-3 py-2 text-sm text-left rounded-lg hover:bg-glass-hover text-primary transition-colors cursor-pointer flex items-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1 2-4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                  Gerar com IA
                </button>
                <button
                  onClick={() => {
                    setAddMenuOpen(false)
                    setManualFormOpen(true)
                  }}
                  className="w-full px-3 py-2 text-sm text-left rounded-lg hover:bg-glass-hover text-primary transition-colors cursor-pointer flex items-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                  Cadastro Manual
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Nenhum item cadastrado"
          description="Adicione itens de conhecimento manualmente ou gere com IA."
          actionLabel="Adicionar Item"
          onAction={() => setAddMenuOpen(true)}
          icon={
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path d="M12 12h24v24H12z" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" />
              <path d="M24 18v12M18 24h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <KnowledgeItemCard
              key={item.id}
              item={item}
              productSlug={productSlug}
              currentModuleName={module?.name || ''}
              onEdit={(i) => {
                setEditingItem(i)
                setManualFormOpen(true)
              }}
              onDelete={setDeleteTarget}
              onToggleActive={handleToggleActive}
              onModuleChange={fetchData}
            />
          ))}
        </div>
      )}

      {/* Manual form */}
      <KnowledgeItemForm
        open={manualFormOpen}
        onClose={() => {
          setManualFormOpen(false)
          setEditingItem(null)
        }}
        onSubmit={editingItem ? handleEdit : handleSave}
        moduleType={module?.type || 'instruction'}
        item={editingItem}
      />

      {/* AI Generate */}
      <AIGeneratePanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        onSave={handleSave}
        moduleType={module?.type || 'instruction'}
      />

      {/* Delete confirmation */}
      <GlassModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir Item"
      >
        <p className="text-secondary mb-6">
          Tem certeza que deseja excluir <strong className="text-primary">{deleteTarget?.title}</strong>?
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
