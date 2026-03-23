'use client'

import { useState, useEffect } from 'react'
import { GlassSelect } from '@/components/ui/GlassSelect'
import type { Product, Module } from '@/lib/types'

interface ProductSelectorProps {
  onProductChange: (slug: string) => void
  onModuleChange: (moduleId: string) => void
  selectedProductSlug: string
  selectedModuleId: string
}

export function ProductSelector({
  onProductChange,
  onModuleChange,
  selectedProductSlug,
  selectedModuleId,
}: ProductSelectorProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [modules, setModules] = useState<Module[]>([])

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedProductSlug) {
      fetch(`/api/products/${selectedProductSlug}/modules`)
        .then((r) => r.json())
        .then(setModules)
        .catch(() => {})
    } else {
      setModules([])
    }
  }, [selectedProductSlug])

  return (
    <div className="flex gap-4 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <GlassSelect
          label="Produto"
          placeholder="Selecione um produto"
          options={products.map((p) => ({ value: p.slug, label: p.name }))}
          value={selectedProductSlug}
          onChange={(e) => {
            onProductChange(e.target.value)
            onModuleChange('')
          }}
        />
      </div>

      {selectedProductSlug && (
        <div className="flex-1 min-w-[200px]">
          <GlassSelect
            label="Módulo (opcional)"
            placeholder="Todos os módulos"
            options={modules.map((m) => ({ value: m.id, label: m.name }))}
            value={selectedModuleId}
            onChange={(e) => onModuleChange(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
