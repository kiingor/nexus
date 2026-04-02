'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ProductCard } from './ProductCard'
import { ProductForm } from './ProductForm'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassModal } from '@/components/ui/GlassModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import type { ProductWithCounts } from '@/lib/types'

interface ProductListProps {
  showCreateButton?: boolean
}

export function ProductList({ showCreateButton = true }: ProductListProps) {
  const { toast } = useToast()
  const [products, setProducts] = useState<ProductWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductWithCounts | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProductWithCounts | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return products
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    )
  }, [products, search])

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products')
      if (res.ok) {
        const data = await res.json()
        setProducts(data)
      }
    } catch {
      toast('Erro ao carregar produtos', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  async function handleCreate(data: { name: string; description: string; slug: string }) {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      toast('Produto criado com sucesso!')
      fetchProducts()
    } else {
      toast('Erro ao criar produto', 'error')
    }
  }

  async function handleEdit(data: { name: string; description: string; slug: string }) {
    if (!editingProduct) return
    const res = await fetch(`/api/products/${editingProduct.slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      toast('Produto atualizado!')
      setEditingProduct(null)
      fetchProducts()
    } else {
      toast('Erro ao atualizar produto', 'error')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/products/${deleteTarget.slug}`, { method: 'DELETE' })
      if (res.ok) {
        toast('Produto excluído!')
        setDeleteTarget(null)
        fetchProducts()
      } else {
        toast('Erro ao excluir produto', 'error')
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
      {showCreateButton && (
        <div className="flex justify-end mb-6">
          <GlassButton onClick={() => setFormOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Novo Produto
          </GlassButton>
        </div>
      )}

      {products.length > 0 && (
        <div className="relative mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4A4A48] pointer-events-none">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto por nome, slug ou descrição..."
            className="w-full h-10 pl-10 pr-9 rounded-xl text-sm text-[#F5F5F0] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] placeholder:text-[#4A4A48] outline-none transition-all duration-200 focus:border-[rgba(255,107,0,0.5)] focus:bg-[rgba(255,255,255,0.06)] focus:shadow-[0_0_0_3px_rgba(255,107,0,0.12)] hover:border-[rgba(255,255,255,0.14)]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A4A48] hover:text-[#8A8A85] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          )}
          {search && (
            <p className="text-xs text-[#4A4A48] mt-2">
              {filteredProducts.length === 0 ? 'Nenhum produto encontrado' : `${filteredProducts.length} resultado${filteredProducts.length > 1 ? 's' : ''}`}
            </p>
          )}
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState
          title="Nenhum produto cadastrado"
          description="Crie seu primeiro produto para começar a estruturar sua base de conhecimento."
          actionLabel="Criar Produto"
          onAction={() => setFormOpen(true)}
          icon={
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path d="M8 16l16-10 16 10-16 10-16-10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M8 24l16 10 16-10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M8 32l16 10 16-10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={(p) => {
                setEditingProduct(p)
                setFormOpen(true)
              }}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <ProductForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingProduct(null)
        }}
        onSubmit={editingProduct ? handleEdit : handleCreate}
        product={editingProduct}
      />

      {/* Delete Confirmation */}
      <GlassModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir Produto"
      >
        <p className="text-secondary mb-6">
          Tem certeza que deseja excluir <strong className="text-primary">{deleteTarget?.name}</strong>?
          Todos os módulos e itens serão removidos permanentemente.
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
