'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'

type Item = { motivo: string; count: number }

type Accent = 'orange' | 'green' | 'yellow'

const ACCENT_BAR: Record<Accent, string> = {
  orange: 'bg-orange-500/70',
  green:  'bg-green-500/70',
  yellow: 'bg-yellow-500/70',
}
const ACCENT_NUM: Record<Accent, string> = {
  orange: 'text-secondary',
  green:  'text-green-400',
  yellow: 'text-yellow-400',
}

// Lista de motivos com barra proporcional ao maior valor da própria lista.
// Reusável pelos 3 cortes: maior volume / mais resolvidos / mais transferidos.
//
// Por default exibe os primeiros `collapsedCount` itens; o usuário pode
// expandir para ver TODOS via "Mostrar mais". Cada instância mantém seu
// próprio estado de expansão.
export function MotivosBarList({
  items,
  title = 'Top motivos de contato',
  accent = 'orange',
  emptyMessage = 'Sem dados no período.',
  collapsedCount = 10,
  hrefFor,
}: {
  items: Item[]
  title?: string
  accent?: Accent
  emptyMessage?: string
  collapsedCount?: number
  // Quando fornecido e retorna uma URL, o motivo vira link pra Lista
  // filtrada. Retornar null deixa o item não-clicável (motivo sem tipo).
  hrefFor?: (motivo: string) => string | null
}) {
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) {
    return (
      <div className="glass p-4 h-full flex flex-col">
        <h3 className="text-xs uppercase tracking-wider text-muted mb-3">{title}</h3>
        <p className="text-sm text-muted text-center py-6">{emptyMessage}</p>
      </div>
    )
  }

  // Escala da barra usa o MAIOR de TODOS os itens (não só os visíveis),
  // pra manter consistência ao expandir/colapsar.
  const max = Math.max(...items.map((i) => i.count), 1)
  const barCls = ACCENT_BAR[accent]
  const numCls = ACCENT_NUM[accent]

  const hasMore = items.length > collapsedCount
  const visibleItems = expanded ? items : items.slice(0, collapsedCount)
  const hiddenCount = items.length - collapsedCount

  return (
    <div className="glass p-4 h-full flex flex-col">
      <h3 className="text-xs uppercase tracking-wider text-muted mb-3">{title}</h3>
      <div className="space-y-2 flex-1">
        {visibleItems.map((it) => {
          const pct = Math.round((it.count / max) * 100)
          const href = hrefFor?.(it.motivo) ?? null
          const inner = (
            <>
              <span
                className={`text-sm flex-1 truncate ${href ? 'text-primary group-hover:text-orange-400 transition-colors' : 'text-primary'}`}
                title={href ? `Ver atendimentos: ${it.motivo}` : it.motivo}
              >
                {it.motivo}
              </span>
              <div className="w-20 h-2 rounded-full bg-white/5 overflow-hidden shrink-0">
                <div
                  className={`h-full ${barCls} rounded-full`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-sm font-mono w-10 text-right shrink-0 ${numCls}`}>
                {it.count.toLocaleString('pt-BR')}
              </span>
            </>
          )
          return href ? (
            <Link
              key={it.motivo}
              href={href}
              className="flex items-center gap-3 group -mx-1.5 px-1.5 py-0.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              {inner}
            </Link>
          ) : (
            <div key={it.motivo} className="flex items-center gap-3">
              {inner}
            </div>
          )
        })}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex items-center justify-center gap-1 text-xs text-muted hover:text-primary transition-colors w-full py-1.5 rounded-lg border border-glass-border hover:border-orange-500/30 cursor-pointer"
        >
          {expanded ? (
            <>
              <ChevronUp size={12} />
              Mostrar menos
            </>
          ) : (
            <>
              <ChevronDown size={12} />
              Mostrar mais ({hiddenCount})
            </>
          )}
        </button>
      )}
    </div>
  )
}
