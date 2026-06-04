'use client'

import { ArrowRightLeft, CheckCircle2, CheckCheck, Headphones, Percent } from 'lucide-react'

type Props = {
  total: number
  resolvidos: number
  parcialmente: number
  transferidos: number
  percentualResolucao: number
}

// 5 cards de KPI no topo do dashboard. Mantém o look-and-feel dos
// StatCard que já existem em /atendimentos pra continuidade visual.
//
// Inclui "Resolvidos Parcialmente" pra atendimentos transferidos que
// foram reclassificados pelo reviewer (entrou parcialmente resolvido
// antes da transferência).
export function KPICards({
  total,
  resolvidos,
  parcialmente,
  transferidos,
  percentualResolucao,
}: Props) {
  const pctResolvidos = total > 0 ? Math.round((resolvidos / total) * 100) : 0
  const pctParcialmente = total > 0 ? Math.round((parcialmente / total) * 100) : 0
  const pctTransferidos = total > 0 ? Math.round((transferidos / total) * 100) : 0
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      <Card
        icon={<Headphones size={18} />}
        label="Total no período"
        value={total.toLocaleString('pt-BR')}
      />
      <Card
        icon={<CheckCircle2 size={18} />}
        label="Resolvidos"
        value={resolvidos.toLocaleString('pt-BR')}
        sub={total > 0 ? `${pctResolvidos}% do total` : undefined}
        accent="green"
      />
      <Card
        icon={<CheckCheck size={18} />}
        label="Resolvidos parcial."
        value={parcialmente.toLocaleString('pt-BR')}
        sub={total > 0 ? `${pctParcialmente}% do total` : undefined}
        accent="emerald"
      />
      <Card
        icon={<ArrowRightLeft size={18} />}
        label="Transferidos"
        value={transferidos.toLocaleString('pt-BR')}
        sub={total > 0 ? `${pctTransferidos}% do total` : undefined}
        accent="yellow"
      />
      <Card
        icon={<Percent size={18} />}
        label="% Resolução"
        value={`${percentualResolucao}%`}
        sub="parcial conta 0.5×"
        accent="green"
      />
    </div>
  )
}

function Card({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent?: 'green' | 'yellow' | 'emerald'
}) {
  const color =
    accent === 'green'
      ? 'text-green-400'
      : accent === 'emerald'
        ? 'text-emerald-300'
        : accent === 'yellow'
          ? 'text-yellow-400'
          : 'text-primary'
  return (
    <div className="glass p-4">
      <div className="flex items-center gap-2 mb-2 text-secondary">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      {sub && <p className="text-[11px] text-secondary mt-1">{sub}</p>}
    </div>
  )
}
