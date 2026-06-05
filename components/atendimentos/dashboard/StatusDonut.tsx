'use client'

import { useState } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

type Bucket = { status: string; count: number }

// Donut + Bar chart alternativos pra distribuição por status:
//  - Donut: bom pra ver PROPORÇÕES (%)
//  - Barras horizontais: bom pra comparar QUANTIDADES absolutas
//
// Toggle inline no header do card permite alternar sem sair do dashboard.
const STATUS_META: Record<string, { label: string; color: string }> = {
  resolvida_ia:           { label: 'Resolvida IA',         color: 'rgba(34, 197, 94, 0.85)'   }, // green-500
  resolvido_parcialmente: { label: 'Resolvido Parcial.',   color: 'rgba(16, 185, 129, 0.85)'  }, // emerald-500
  transferida:            { label: 'Transferida',          color: 'rgba(234, 179, 8, 0.85)'   }, // yellow-500
  em_atendimento:         { label: 'Em atendimento',       color: 'rgba(59, 130, 246, 0.85)'  }, // blue-500
  interrompida:           { label: 'Interrompida',         color: 'rgba(239, 68, 68, 0.85)'   }, // red-500
}

type ChartMode = 'donut' | 'bar'

export function StatusDonut({ data }: { data: Bucket[] }) {
  const [mode, setMode] = useState<ChartMode>('donut')
  const total = data.reduce((s, b) => s + b.count, 0)

  if (total === 0) {
    return (
      <div className="glass p-4 h-full flex flex-col">
        <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Distribuição por status</h3>
        <p className="text-sm text-secondary text-center py-8">Sem dados no período.</p>
      </div>
    )
  }

  const labels = data.map((b) => STATUS_META[b.status]?.label ?? b.status)
  const values = data.map((b) => b.count)
  const colors = data.map((b) => STATUS_META[b.status]?.color ?? 'rgba(148, 163, 184, 0.6)')

  return (
    <div className="glass p-4 h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-xs uppercase tracking-wider text-secondary">
          Distribuição por status {mode === 'donut' ? '(%)' : '(qtd)'}
        </h3>
        {/* Toggle Donut / Barras */}
        <div className="inline-flex rounded-lg border border-glass-border bg-base/40 p-0.5">
          <button
            type="button"
            onClick={() => setMode('donut')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
              mode === 'donut'
                ? 'bg-orange-500/20 text-orange-300'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Donut
          </button>
          <button
            type="button"
            onClick={() => setMode('bar')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
              mode === 'bar'
                ? 'bg-orange-500/20 text-orange-300'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Barras
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-[240px] relative">
        {mode === 'donut' ? (
          <Doughnut
            data={{
              labels,
              datasets: [
                {
                  data: values,
                  backgroundColor: colors,
                  borderColor: 'rgba(0,0,0,0)',
                  borderWidth: 0,
                  hoverOffset: 6,
                },
              ],
            }}
            options={
              {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: {
                      color: 'rgba(229, 231, 235, 0.9)',
                      font: { size: 11 },
                      boxWidth: 10,
                      padding: 12,
                    },
                  },
                  tooltip: {
                    callbacks: {
                      label(ctx) {
                        const value = Number(ctx.parsed)
                        const pct = total > 0 ? Math.round((value / total) * 100) : 0
                        return `${ctx.label}: ${value} (${pct}%)`
                      },
                    },
                  },
                },
              } as ChartOptions<'doughnut'>
            }
          />
        ) : (
          <Bar
            data={{
              labels,
              datasets: [
                {
                  label: 'Atendimentos',
                  data: values,
                  backgroundColor: colors,
                  borderRadius: 4,
                  borderSkipped: false,
                },
              ],
            }}
            options={
              {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // barras horizontais — mais legíveis pra labels longas
                scales: {
                  x: {
                    beginAtZero: true,
                    ticks: {
                      color: 'rgba(199, 199, 194, 0.85)',
                      font: { size: 11 },
                      precision: 0,
                    },
                    grid: { color: 'rgba(148, 163, 184, 0.1)' },
                  },
                  y: {
                    ticks: { color: 'rgba(199, 199, 194, 0.85)', font: { size: 11 } },
                    grid: { display: false },
                  },
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label(ctx) {
                        const value = Number(ctx.parsed.x)
                        const pct = total > 0 ? Math.round((value / total) * 100) : 0
                        return `${value} atendimentos (${pct}%)`
                      },
                    },
                  },
                },
              } as ChartOptions<'bar'>
            }
          />
        )}
      </div>
    </div>
  )
}
