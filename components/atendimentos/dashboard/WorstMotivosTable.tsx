'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

type Row = {
  motivo: string
  total: number
  resolvidos: number
  transferidos: number
  finalizados: number
  percentual: number | null
}

// Tabela com motivos de pior taxa de resolução — útil pra identificar
// onde a IA mais transfere e precisa melhorar.
// Mostra os primeiros `collapsedCount` por padrão; "Mostrar mais" expande.
export function WorstMotivosTable({
  rows,
  collapsedCount = 6,
}: {
  rows: Row[]
  collapsedCount?: number
}) {
  const [expanded, setExpanded] = useState(false)

  if (rows.length === 0) {
    return (
      <div className="glass p-4">
        <h3 className="text-xs uppercase tracking-wider text-muted mb-3">
          Motivos com pior taxa de resolução
        </h3>
        <p className="text-sm text-muted text-center py-6">
          Sem dados suficientes (precisa de ≥3 atendimentos finalizados por motivo).
        </p>
      </div>
    )
  }

  const hasMore = rows.length > collapsedCount
  const visibleRows = expanded ? rows : rows.slice(0, collapsedCount)
  const hiddenCount = rows.length - collapsedCount

  return (
    <div className="glass p-4">
      <h3 className="text-xs uppercase tracking-wider text-muted mb-3">
        Motivos com pior taxa de resolução
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-glass-border text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-2 py-2 font-medium">Motivo</th>
              <th className="px-2 py-2 font-medium text-right">Total</th>
              <th className="px-2 py-2 font-medium text-right">Resolv.</th>
              <th className="px-2 py-2 font-medium text-right">Transf.</th>
              <th className="px-2 py-2 font-medium text-right">% Resol.</th>
              <th className="px-2 py-2 font-medium w-32"></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => {
              const pct = r.percentual ?? 0
              const barColor =
                pct >= 70 ? 'bg-green-500/70' : pct >= 40 ? 'bg-yellow-500/70' : 'bg-red-500/70'
              const pctColor =
                pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400'
              return (
                <tr key={r.motivo} className="border-b border-glass-border/50 last:border-0">
                  <td className="px-2 py-2 text-sm text-primary">{r.motivo}</td>
                  <td className="px-2 py-2 text-sm text-secondary text-right font-mono">{r.total}</td>
                  <td className="px-2 py-2 text-sm text-green-400 text-right font-mono">{r.resolvidos}</td>
                  <td className="px-2 py-2 text-sm text-yellow-400 text-right font-mono">{r.transferidos}</td>
                  <td className={`px-2 py-2 text-sm text-right font-mono font-semibold ${pctColor}`}>
                    {pct}%
                  </td>
                  <td className="px-2 py-2">
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
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
