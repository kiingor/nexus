'use client'

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
export function MotivosBarList({
  items,
  title = 'Top motivos de contato',
  accent = 'orange',
  emptyMessage = 'Sem dados no período.',
}: {
  items: Item[]
  title?: string
  accent?: Accent
  emptyMessage?: string
}) {
  if (items.length === 0) {
    return (
      <div className="glass p-4 h-full flex flex-col">
        <h3 className="text-xs uppercase tracking-wider text-muted mb-3">{title}</h3>
        <p className="text-sm text-muted text-center py-6">{emptyMessage}</p>
      </div>
    )
  }
  const max = Math.max(...items.map((i) => i.count), 1)
  const barCls = ACCENT_BAR[accent]
  const numCls = ACCENT_NUM[accent]
  return (
    <div className="glass p-4 h-full flex flex-col">
      <h3 className="text-xs uppercase tracking-wider text-muted mb-3">{title}</h3>
      <div className="space-y-2 flex-1">
        {items.map((it) => {
          const pct = Math.round((it.count / max) * 100)
          return (
            <div key={it.motivo} className="flex items-center gap-3">
              <span className="text-sm text-primary flex-1 truncate" title={it.motivo}>
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
