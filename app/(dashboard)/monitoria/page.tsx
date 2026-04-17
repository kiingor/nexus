'use client'

import { useState, useEffect, useMemo } from 'react'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Spinner } from '@/components/ui/Spinner'
import { MonitoriaList } from '@/components/monitoria/MonitoriaList'
import { MonitoriaDetailModal } from '@/components/monitoria/MonitoriaDetailModal'
import { ClipboardCheck, TrendingUp, Users, Star } from 'lucide-react'
import { toNumber } from '@/lib/monitoria'
import type { MonitoriaRecord } from '@/lib/types'

export default function MonitoriaPage() {
  const [records, setRecords] = useState<MonitoriaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<MonitoriaRecord | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/monitoria?limit=200')
      const data = await res.json()
      setRecords(Array.isArray(data) ? data : [])
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleDelete(id: string) {
    const res = await fetch(`/api/monitoria/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRecords((prev) => prev.filter((r) => r.id !== id))
      if (selected?.id === id) setSelected(null)
    }
  }

  const stats = useMemo(() => {
    const iaValues = records.map((r) => toNumber(r.nota_avaliacao)).filter((n): n is number => n != null)
    const clienteValues = records.map((r) => toNumber(r.nota_cliente)).filter((n): n is number => n != null)

    const avgIA = iaValues.length > 0 ? iaValues.reduce((s, n) => s + n, 0) / iaValues.length : 0
    const avgCliente = clienteValues.length > 0 ? clienteValues.reduce((s, n) => s + n, 0) / clienteValues.length : 0

    return {
      total: records.length,
      avgIA: avgIA.toFixed(1),
      avgCliente: avgCliente.toFixed(1),
      evaluatedCount: iaValues.length,
    }
  }, [records])

  return (
    <div>
      <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Monitoria' }]} />
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary">Monitoria</h1>
          <p className="text-secondary mt-1">
            Avaliações de qualidade do atendimento da IA
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<ClipboardCheck size={18} />}
          label="Total avaliadas"
          value={String(stats.total)}
        />
        <StatCard
          icon={<Star size={18} />}
          label="Nota média da IA"
          value={stats.avgIA}
          suffix="/ 10"
          accent
        />
        <StatCard
          icon={<Users size={18} />}
          label="Nota média cliente"
          value={stats.avgCliente}
          suffix="/ 10"
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="Com avaliação IA"
          value={String(stats.evaluatedCount)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : records.length === 0 ? (
        <div className="glass p-12 text-center">
          <ClipboardCheck size={32} className="mx-auto mb-3 text-muted" />
          <p className="text-primary font-medium mb-1">Nenhuma monitoria ainda</p>
          <p className="text-sm text-muted">
            Vá até <span className="text-orange-400">Testar</span> e clique em &quot;Avaliar Atendimento&quot; depois de uma conversa.
          </p>
        </div>
      ) : (
        <MonitoriaList
          records={records}
          onSelect={setSelected}
          onDelete={handleDelete}
        />
      )}

      <MonitoriaDetailModal
        record={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  suffix,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  suffix?: string
  accent?: boolean
}) {
  return (
    <div className="glass p-4">
      <div className="flex items-center gap-2 mb-2 text-muted">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`text-2xl font-bold ${accent ? 'text-orange-400' : 'text-primary'}`}
        >
          {value}
        </span>
        {suffix && <span className="text-xs text-muted">{suffix}</span>}
      </div>
    </div>
  )
}
