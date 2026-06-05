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

// Stacked bar chart de volume diário NORMALIZADO em PORCENTAGEM (0-100%).
// Cada barra do dia soma 100% — assim dá pra ver a EVOLUÇÃO da composição
// (% resolvidos vs % transferidos etc.) sem viés do volume absoluto, que
// varia muito ao longo do tempo.
//
// Tooltip mostra tanto % quanto contagem absoluta pra contexto.
export function DailyVolumeChart({ data }: { data: DailyBucket[] }) {
  if (data.length === 0) {
    return (
      <div className="glass p-4 h-full flex flex-col">
        <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Volume diário por status (%)</h3>
        <p className="text-sm text-secondary text-center py-8">Sem dados no período.</p>
      </div>
    )
  }

  // Totais por dia pra normalizar.
  const totais = data.map((d) => d.resolvidos + d.parcialmente + d.transferidos + d.outros)

  // Helper: % de um valor sobre o total do dia. Retorna 0 quando o
  // total do dia for 0 (caso degenerado — não deveria acontecer porque
  // só dias com algum registro entram na resposta).
  const pct = (i: number, value: number) => (totais[i] > 0 ? (value / totais[i]) * 100 : 0)

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
        data: data.map((d, i) => pct(i, d.resolvidos)),
        backgroundColor: 'rgba(34, 197, 94, 0.85)',
        borderRadius: 4,
        stack: 'status',
        // dado bruto preservado pra tooltip mostrar a quantidade absoluta também
        absolutos: data.map((d) => d.resolvidos),
      },
      {
        label: 'Resolvidos parcial.',
        data: data.map((d, i) => pct(i, d.parcialmente)),
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderRadius: 4,
        stack: 'status',
        absolutos: data.map((d) => d.parcialmente),
      },
      {
        label: 'Transferidos',
        data: data.map((d, i) => pct(i, d.transferidos)),
        backgroundColor: 'rgba(234, 179, 8, 0.85)',
        borderRadius: 4,
        stack: 'status',
        absolutos: data.map((d) => d.transferidos),
      },
      {
        label: 'Outros',
        data: data.map((d, i) => pct(i, d.outros)),
        backgroundColor: 'rgba(148, 163, 184, 0.55)',
        borderRadius: 4,
        stack: 'status',
        absolutos: data.map((d) => d.outros),
      },
    ],
  }

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        ticks: { color: 'rgba(199, 199, 194, 0.85)', font: { size: 11 } },
        grid: { display: false },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        max: 100,
        ticks: {
          color: 'rgba(199, 199, 194, 0.85)',
          font: { size: 11 },
          stepSize: 25,
          callback: (v) => `${v}%`,
        },
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
      },
    },
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
            // Pega o dado absoluto guardado no dataset
            const ds = ctx.dataset as unknown as { absolutos?: number[] }
            const abs = ds.absolutos?.[ctx.dataIndex] ?? 0
            const p = Number(ctx.parsed.y || 0)
            return `${ctx.dataset.label}: ${p.toFixed(1)}% (${abs})`
          },
          footer(items) {
            // Mostra total do dia (soma das absolutas)
            const idx = items[0]?.dataIndex ?? 0
            const total = totais[idx]
            return `Total no dia: ${total}`
          },
        },
      },
    },
  }

  return (
    <div className="glass p-4 h-full flex flex-col">
      <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Volume diário por status (%)</h3>
      <div className="flex-1 min-h-[240px] relative">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  )
}
