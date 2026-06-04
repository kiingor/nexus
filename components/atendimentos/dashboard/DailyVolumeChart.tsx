'use client'

import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

type DailyBucket = {
  date: string
  resolvidos: number
  parcialmente: number
  transferidos: number
  outros: number
}

// Stacked bar chart de volume diário, separado por status.
// Cores alinhadas ao donut.
export function DailyVolumeChart({ data }: { data: DailyBucket[] }) {
  if (data.length === 0) {
    return (
      <div className="glass p-4 h-full flex flex-col">
        <h3 className="text-xs uppercase tracking-wider text-muted mb-3">Volume diário por status</h3>
        <p className="text-sm text-muted text-center py-8">Sem dados no período.</p>
      </div>
    )
  }

  // Formata YYYY-MM-DD pra DD/MM (eixo X mais legível em períodos curtos).
  const labels = data.map((d) => {
    const [, m, day] = d.date.split('-')
    return `${day}/${m}`
  })

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Resolvidos',
        data: data.map((d) => d.resolvidos),
        backgroundColor: 'rgba(34, 197, 94, 0.75)',
        borderRadius: 4,
        stack: 'status',
      },
      {
        label: 'Resolvidos parcial.',
        data: data.map((d) => d.parcialmente),
        backgroundColor: 'rgba(16, 185, 129, 0.75)',
        borderRadius: 4,
        stack: 'status',
      },
      {
        label: 'Transferidos',
        data: data.map((d) => d.transferidos),
        backgroundColor: 'rgba(234, 179, 8, 0.75)',
        borderRadius: 4,
        stack: 'status',
      },
      {
        label: 'Outros',
        data: data.map((d) => d.outros),
        backgroundColor: 'rgba(148, 163, 184, 0.45)',
        borderRadius: 4,
        stack: 'status',
      },
    ],
  }

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        ticks: { color: 'rgba(148, 163, 184, 0.85)', font: { size: 11 } },
        grid: { display: false },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          color: 'rgba(148, 163, 184, 0.85)',
          font: { size: 11 },
          precision: 0,
        },
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
      },
    },
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
          footer(items) {
            const sum = items.reduce((s, it) => s + Number(it.parsed.y || 0), 0)
            return `Total: ${sum}`
          },
        },
      },
    },
  }

  return (
    <div className="glass p-4 h-full flex flex-col">
      <h3 className="text-xs uppercase tracking-wider text-muted mb-3">Volume diário por status</h3>
      <div className="flex-1 min-h-[240px] relative">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  )
}
