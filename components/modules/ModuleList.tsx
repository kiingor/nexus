'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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

  // Filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'instruction' | 'error'>('all')
  const [sortField, setSortField] = useState<'name' | 'created_at' | 'item_count'>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const filteredModules = useMemo(() => {
    const q = search.toLowerCase().trim()
    let result = modules

    if (q) {
      result = result.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.keywords?.some((k: string) => k.toLowerCase().includes(q))
      )
    }

    if (typeFilter !== 'all') {
      result = result.filter(m => m.type === typeFilter)
    }

    result = [...result].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name, 'pt-BR'); break
        case 'created_at': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break
        case 'item_count': cmp = (a.item_count || 0) - (b.item_count || 0); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [modules, search, typeFilter, sortField, sortDir])

  const hasActiveFilters = search !== '' || typeFilter !== 'all'

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir(field === 'name' ? 'asc' : 'desc') }
  }

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

      {modules.length > 0 && (
        <div className="mb-6 space-y-3">
          {/* Search + Sort */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4A4A48] pointer-events-none">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, descrição ou palavras-chave..."
                className="w-full h-10 pl-10 pr-9 rounded-xl text-sm text-[#F5F5F0] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] placeholder:text-[#4A4A48] outline-none transition-all duration-200 focus:border-[rgba(255,107,0,0.5)] focus:bg-[rgba(255,255,255,0.06)] focus:shadow-[0_0_0_3px_rgba(255,107,0,0.12)] hover:border-[rgba(255,255,255,0.14)]"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A4A48] hover:text-[#8A8A85] transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {([['name', 'Nome'], ['created_at', 'Criação'], ['item_count', 'Itens']] as const).map(([field, label]) => {
                const active = sortField === field
                return (
                  <button
                    key={field}
                    onClick={() => toggleSort(field)}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${active ? 'bg-[rgba(255,107,0,0.12)] text-[#FF8533] border border-[rgba(255,107,0,0.25)]' : 'bg-[rgba(255,255,255,0.04)] text-[#8A8A85] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.14)] hover:text-[#F5F5F0]'}`}
                  >
                    {label}
                    {active && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        {sortDir === 'asc' ? <path d="m3 8 4-4 4 4M7 4v16M11 12h4M11 16h7M11 20h10" /> : <path d="m3 16 4 4 4-4M7 20V4M11 4h10M11 8h7M11 12h4" />}
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Type filter */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#4A4A48] mr-1">Tipo:</span>
              {([['all', 'Todos'], ['instruction', 'Instrução'], ['error', 'Erro']] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setTypeFilter(value)}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${typeFilter === value ? 'bg-[rgba(255,107,0,0.12)] text-[#FF8533] border border-[rgba(255,107,0,0.25)]' : 'bg-[rgba(255,255,255,0.04)] text-[#8A8A85] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.14)] hover:text-[#F5F5F0]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => { setSearch(''); setTypeFilter('all') }}
                className="inline-flex items-center gap-1 text-xs text-[#8A8A85] hover:text-[#F5F5F0] transition-colors cursor-pointer"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                Limpar filtros
              </button>
            )}
          </div>

          {/* Results info */}
          {hasActiveFilters && (
            <p className="text-xs text-[#4A4A48]">
              {filteredModules.length === 0 ? 'Nenhum módulo encontrado' : `${filteredModules.length} de ${modules.length} módulo${modules.length > 1 ? 's' : ''}`}
            </p>
          )}
        </div>
      )}

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
      ) : filteredModules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#4A4A48]"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            </div>
            <p className="text-sm text-[#8A8A85] mb-1">Nenhum módulo encontrado</p>
            <p className="text-xs text-[#4A4A48] mb-4">Tente ajustar os filtros de busca</p>
            <button onClick={() => { setSearch(''); setTypeFilter('all') }} className="text-xs text-[#FF8533] hover:text-[#FF6B00] transition-colors cursor-pointer">Limpar filtros</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredModules.map((mod) => (
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
        )
      }

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
