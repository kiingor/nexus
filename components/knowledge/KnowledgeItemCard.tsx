'use client'

import { useState, useRef, useEffect } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { GlassButton } from '@/components/ui/GlassButton'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import { InstructionView } from './InstructionView'
import { ErrorView } from './ErrorView'
import type { KnowledgeItem, InstructionContent, ErrorContent, Module } from '@/lib/types'

interface KnowledgeItemCardProps {
  item: KnowledgeItem
  productSlug: string
  currentModuleName: string
  onEdit: (item: KnowledgeItem) => void
  onDelete: (item: KnowledgeItem) => void
  onToggleActive: (item: KnowledgeItem) => void
  onModuleChange: () => void
}

export function KnowledgeItemCard({ item, productSlug, currentModuleName, onEdit, onDelete, onToggleActive, onModuleChange }: KnowledgeItemCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showModuleSelector, setShowModuleSelector] = useState(false)
  const [modules, setModules] = useState<Module[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [changingModule, setChangingModule] = useState(false)
  const { toast } = useToast()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showModuleSelector) return

    let cancelled = false
    fetch(`/api/products/${productSlug}/modules`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!cancelled) setModules(data) })
      .catch(() => {})

    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowModuleSelector(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      cancelled = true
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showModuleSelector, productSlug])

  async function handleMoveToModule(moduleId: string) {
    if (moduleId === item.module_id) {
      setShowModuleSelector(false)
      return
    }
    setChangingModule(true)
    try {
      const res = await fetch(`/api/products/${productSlug}/knowledge/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module_id: moduleId }),
      })
      if (res.ok) {
        const targetModule = modules.find(m => m.id === moduleId)
        toast(`Item movido para "${targetModule?.name}"`)
        setShowModuleSelector(false)
        onModuleChange()
      } else {
        toast('Erro ao mover item', 'error')
      }
    } catch {
      toast('Erro ao mover item', 'error')
    } finally {
      setChangingModule(false)
    }
  }

  const filteredModules = modules.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
  )

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

      {/* Module group selector */}
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => setShowModuleSelector(!showModuleSelector)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-glass border border-glass-border text-xs text-secondary hover:text-primary hover:border-orange-500/30 transition-all cursor-pointer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          {changingModule ? 'Movendo...' : currentModuleName}
        </button>

        {showModuleSelector && (
          <div ref={dropdownRef} className="relative z-30">
            <div className="glass p-2 min-w-[240px] max-w-[320px] rounded-xl shadow-xl">
              <div className="relative mb-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar módulo..."
                  autoFocus
                  className="w-full h-8 pl-8 pr-3 rounded-lg bg-[rgba(255,255,255,0.06)] border border-glass-border text-sm text-primary placeholder:text-muted outline-none focus:border-orange-500/50 transition-all"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filteredModules.length === 0 && (
                  <p className="text-xs text-muted text-center py-3">Nenhum módulo encontrado</p>
                )}
                {filteredModules.map(mod => (
                  <button
                    key={mod.id}
                    onClick={() => handleMoveToModule(mod.id)}
                    disabled={changingModule}
                    className={cn(
                      'w-full px-3 py-2 text-sm text-left rounded-lg transition-all cursor-pointer',
                      mod.id === item.module_id
                        ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                        : 'hover:bg-glass-hover text-primary'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{mod.name}</span>
                      {mod.id === item.module_id && (
                        <GlassBadge variant="instruction">Atual</GlassBadge>
                      )}
                    </div>
                    {mod.description && (
                      <p className="text-xs text-muted truncate mt-0.5">{mod.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
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
