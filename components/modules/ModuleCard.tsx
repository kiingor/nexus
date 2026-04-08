'use client'

import Link from 'next/link'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassButton } from '@/components/ui/GlassButton'
import { cn } from '@/lib/utils'
import type { ModuleWithCount } from '@/lib/types'

interface ModuleCardProps {
  module: ModuleWithCount
  productSlug: string
  onEdit: (mod: ModuleWithCount) => void
  onDelete: (mod: ModuleWithCount) => void
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

export function ModuleCard({ module, productSlug, onEdit, onDelete, selectable, selected, onToggleSelect }: ModuleCardProps) {
  return (
    <GlassCard hover className={cn('relative p-5 flex flex-col gap-3', selected && 'glow-orange bg-orange-500/5')}>
      {selectable && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect?.() }}
          className="absolute top-3 left-3 cursor-pointer"
        >
          <div
            className={cn(
              'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
              selected
                ? 'bg-orange-500 border-orange-500'
                : 'border-glass-border hover:border-orange-500/50'
            )}
          >
            {selected && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </button>
      )}
      <div className={cn('flex items-start justify-between', selectable && 'pl-7')}>
        <div className="flex-1">
          <h3 className="text-base font-display font-semibold text-primary mb-1">
            {module.name}
          </h3>
          {module.description && (
            <p className="text-sm text-secondary line-clamp-2">{module.description}</p>
          )}
        </div>
        <GlassBadge variant={module.type === 'instruction' ? 'instruction' : 'error'}>
          {module.type === 'instruction' ? 'Instrução' : 'Erro'}
        </GlassBadge>
      </div>

      <div className="flex items-center gap-2">
        <GlassBadge>{module.item_count} itens</GlassBadge>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-glass-border">
        <Link href={`/products/${productSlug}/modules/${module.id}`} className="flex-1">
          <GlassButton variant="primary" size="sm" className="w-full">
            Abrir
          </GlassButton>
        </Link>
        <GlassButton variant="ghost" size="sm" onClick={() => onEdit(module)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </GlassButton>
        <GlassButton variant="ghost" size="sm" onClick={() => onDelete(module)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 5h8l-.5 8.5a1 1 0 01-1 .5H5.5a1 1 0 01-1-.5L4 5zM6 7v5M8 7v5M10 7v5M3 4h10M6.5 4V2.5h3V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </GlassButton>
      </div>
    </GlassCard>
  )
}
