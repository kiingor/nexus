'use client'

import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

type Bucket = { status: string; count: number }

// Donut de distribuição por status (resolvida_ia / transferida / em_atendimento / interrompida).
// Cores alinhadas com os badges já usados na Lista.
const STATUS_META: Record<string, { label: string; color: string }> = {
  resolvida_ia:   { label: 'Resolvida IA',   color: 'rgba(34, 197, 94, 0.85)'   }, // green-500
  transferida:    { label: 'Transferida',    color: 'rgba(234, 179, 8, 0.85)'   }, // yellow-500
  em_atendimento: { label: 'Em atendimento', color: 'rgba(59, 130, 246, 0.85)'  }, // blue-500
  interrompida:   { label: 'Interrompida',   color: 'rgba(239, 68, 68, 0.85)'   }, // red-500
}

export function StatusDonut({ data }: { data: Bucket[] }) {
  const total = data.reduce((s, b) => s + b.count, 0)
  if (total === 0) {
    return (
      <div className="glass p-4 h-full flex flex-col">
        <h3 className="text-xs uppercase tracking-wider text-muted mb-3">Distribuição por status</h3>
        <p className="text-sm text-muted text-center py-8">Sem dados no período.</p>
      </div>
    )
  }

  const labels = data.map((b) => STATUS_META[b.status]?.label ?? b.status)
  const values = data.map((b) => b.count)
  const colors = data.map((b) => STATUS_META[b.status]?.color ?? 'rgba(148, 163, 184, 0.6)')

  const chartData = {
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
  }

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: 'rgba(229, 231, 235, 0.85)',
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
  }

  return (
    <div className="glass p-4 h-full flex flex-col">
      <h3 className="text-xs uppercase tracking-wider text-muted mb-3">Distribuição por status</h3>
      <div className="flex-1 min-h-[240px] relative">
        <Doughnut data={chartData} options={options} />
      </div>
    </div>
  )
}
