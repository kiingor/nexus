'use client'

import { useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassButton } from '@/components/ui/GlassButton'
import { InstructionView } from './InstructionView'
import { ErrorView } from './ErrorView'
import { cn } from '@/lib/utils'
import type { KnowledgeItem, InstructionContent, ErrorContent } from '@/lib/types'

interface KnowledgeItemCardProps {
  item: KnowledgeItem
  onEdit: (item: KnowledgeItem) => void
  onDelete: (item: KnowledgeItem) => void
  onToggleActive: (item: KnowledgeItem) => void
}

export function KnowledgeItemCard({ item, onEdit, onDelete, onToggleActive }: KnowledgeItemCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-primary truncate">{item.title}</h4>
            <GlassBadge variant={item.type === 'instruction' ? 'instruction' : 'error'}>
              {item.type === 'instruction' ? 'Instrução' : 'Erro'}
            </GlassBadge>
          </div>
          <p className="text-xs text-muted">
            {item.type === 'instruction'
              ? `${(item.content as InstructionContent).steps.length} passos`
              : (item.content as ErrorContent).error_code || 'Sem código'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {/* Active toggle */}
          <button
            onClick={() => onToggleActive(item)}
            className={cn(
              'relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer',
              item.is_active ? 'bg-green-500/30' : 'bg-glass'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200',
                item.is_active ? 'left-5.5 bg-green-400' : 'left-0.5 bg-muted'
              )}
            />
          </button>

          <GlassButton variant="ghost" size="sm" onClick={() => onEdit(item)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </GlassButton>
          <GlassButton variant="ghost" size="sm" onClick={() => onDelete(item)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 5h8l-.5 8.5a1 1 0 01-1 .5H5.5a1 1 0 01-1-.5L4 5zM6 7v5M8 7v5M10 7v5M3 4h10M6.5 4V2.5h3V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </GlassButton>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-glass-border">
          {item.type === 'instruction' ? (
            <InstructionView content={item.content as InstructionContent} />
          ) : (
            <ErrorView content={item.content as ErrorContent} />
          )}
        </div>
      )}
    </GlassCard>
  )
}
