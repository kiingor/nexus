'use client'

import Link from 'next/link'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassButton } from '@/components/ui/GlassButton'
import type { ProductWithCounts } from '@/lib/types'

interface ProductCardProps {
  product: ProductWithCounts
  onEdit: (product: ProductWithCounts) => void
  onDelete: (product: ProductWithCounts) => void
}

export function ProductCard({ product, onEdit, onDelete }: ProductCardProps) {
  return (
    <GlassCard hover className="p-5 flex flex-col gap-4">
      <div className="flex-1">
        <h3 className="text-lg font-display font-semibold text-primary mb-1">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-sm text-secondary line-clamp-2">{product.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <GlassBadge>{product.module_count} módulos</GlassBadge>
        <GlassBadge>{product.item_count} itens</GlassBadge>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-glass-border">
        <Link href={`/products/${product.slug}`} className="flex-1">
          <GlassButton variant="primary" size="sm" className="w-full">
            Acessar
          </GlassButton>
        </Link>
        <GlassButton variant="ghost" size="sm" onClick={() => onEdit(product)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </GlassButton>
        <GlassButton variant="ghost" size="sm" onClick={() => onDelete(product)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 5h8l-.5 8.5a1 1 0 01-1 .5H5.5a1 1 0 01-1-.5L4 5zM6 7v5M8 7v5M10 7v5M3 4h10M6.5 4V2.5h3V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </GlassButton>
      </div>
    </GlassCard>
  )
}
