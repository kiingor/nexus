'use client'

type Item = { motivo: string; count: number }

// Lista horizontal com barra proporcional ao maior valor.
// Componente "puro": tudo client-side, sem chart.js, mais leve.
export function MotivosBarList({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <div className="glass p-4">
        <h3 className="text-xs uppercase tracking-wider text-muted mb-3">Top motivos de contato</h3>
        <p className="text-sm text-muted text-center py-6">Sem dados no período.</p>
      </div>
    )
  }
  const max = Math.max(...items.map((i) => i.count), 1)
  return (
    <div className="glass p-4">
      <h3 className="text-xs uppercase tracking-wider text-muted mb-3">Top motivos de contato</h3>
      <div className="space-y-2">
        {items.map((it) => {
          const pct = Math.round((it.count / max) * 100)
          return (
            <div key={it.motivo} className="flex items-center gap-3">
              <span className="text-sm text-primary w-44 truncate" title={it.motivo}>
                {it.motivo}
              </span>
              <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-orange-500/70 rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm text-secondary font-mono w-12 text-right">
                {it.count.toLocaleString('pt-BR')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
