'use client'

import { ArrowRightLeft, CheckCircle2, Headphones, Percent } from 'lucide-react'

type Props = {
  total: number
  resolvidos: number
  transferidos: number
  percentualResolucao: number
}

// 4 cards de KPI no topo do dashboard. Mantém o look-and-feel dos
// StatCard que já existem em /atendimentos pra continuidade visual.
export function KPICards({ total, resolvidos, transferidos, percentualResolucao }: Props) {
  const pctResolvidos = total > 0 ? Math.round((resolvidos / total) * 100) : 0
  const pctTransferidos = total > 0 ? Math.round((transferidos / total) * 100) : 0
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
        sub="sobre finalizados"
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
  accent?: 'green' | 'yellow'
}) {
  const color =
    accent === 'green'
      ? 'text-green-400'
      : accent === 'yellow'
        ? 'text-yellow-400'
        : 'text-primary'
  return (
    <div className="glass p-4">
      <div className="flex items-center gap-2 mb-2 text-muted">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      {sub && <p className="text-[11px] text-muted mt-1">{sub}</p>}
    </div>
  )
}
