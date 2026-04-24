'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Spinner } from '@/components/ui/Spinner'
import { AtendimentosList } from '@/components/atendimentos/AtendimentosList'
import { AtendimentoDetailModal } from '@/components/atendimentos/AtendimentoDetailModal'
import { Headphones, CheckCircle2, ArrowRightLeft, XCircle, Filter, DollarSign } from 'lucide-react'
import type { AtendimentoRecord, AvaliacaoAtendimentoRecord } from '@/lib/types'
import { formatCusto, toNumber } from '@/lib/atendimentos'

type StatusFilter = 'all' | 'transferida' | 'resolvida_ia' | 'interrompida'
type DestinoFilter = 'all' | 'servicedesk' | 'financeiro'
type SentimentoFilter = 'all' | 'positivo' | 'neutro' | 'negativo'

// Intervalo [from, to) no fuso UTC-3 (horário de Brasília)
function buildDateRange(day: string, hour: string): { from?: string; to?: string } {
  if (!day) return {}
  if (hour === 'all' || hour === '') {
    return {
      from: `${day}T00:00:00-03:00`,
      to: `${day}T23:59:59.999-03:00`,
    }
  }
  const h = Number(hour)
  const nextH = h + 1
  const pad = (n: number) => String(n).padStart(2, '0')
  if (nextH >= 24) {
    // Última faixa 23:00 → próximo dia 00:00
    const d = new Date(`${day}T00:00:00-03:00`)
    d.setDate(d.getDate() + 1)
    const nextDay = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    return {
      from: `${day}T23:00:00-03:00`,
      to: `${nextDay}T00:00:00-03:00`,
    }
  }
  return {
    from: `${day}T${pad(h)}:00:00-03:00`,
    to: `${day}T${pad(nextH)}:00:00-03:00`,
  }
}

export default function AtendimentosPage() {
  const [records, setRecords] = useState<AtendimentoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AtendimentoRecord | null>(null)
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoAtendimentoRecord[]>([])
  const [loadingAvaliacoes, setLoadingAvaliacoes] = useState(false)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [destinoFilter, setDestinoFilter] = useState<DestinoFilter>('all')
  const [comProblema, setComProblema] = useState(false)
  const [search, setSearch] = useState('')
  const [dayFilter, setDayFilter] = useState('')
  const [hourFilter, setHourFilter] = useState<'all' | string>('all')
  const [sentimentoFilter, setSentimentoFilter] = useState<SentimentoFilter>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (destinoFilter !== 'all') params.set('destino', destinoFilter)
      if (comProblema) params.set('com_problema', 'true')
      const { from, to } = buildDateRange(dayFilter, hourFilter)
      if (from) params.set('from', from)
      if (to) params.set('to', to)

      const res = await fetch(`/api/atendimentos?${params.toString()}`)
      const data = await res.json()
      setRecords(Array.isArray(data) ? data : [])
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, destinoFilter, comProblema, dayFilter, hourFilter])

  useEffect(() => {
    load()
  }, [load])

  const openDetail = useCallback(async (record: AtendimentoRecord) => {
    setSelected(record)
    setAvaliacoes([])
    setLoadingAvaliacoes(true)
    try {
      const res = await fetch(`/api/atendimentos/${record.id}`)
      const data = await res.json()
      setAvaliacoes(Array.isArray(data?.avaliacoes) ? data.avaliacoes : [])
    } catch {
      setAvaliacoes([])
    } finally {
      setLoadingAvaliacoes(false)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = records
    if (sentimentoFilter !== 'all') {
      out = out.filter((r) => {
        const s = (r.sentimento_cliente || '').toLowerCase()
        if (sentimentoFilter === 'positivo')
          return /positiv|satisfe|feliz|bom|[óo]timo|excelente/i.test(s)
        if (sentimentoFilter === 'negativo')
          return /negativ|insatisfe|irrita|frustra|ruim|p[ée]ssimo|raiva/i.test(s)
        if (sentimentoFilter === 'neutro') return /neutr|ok|indifer/i.test(s)
        return true
      })
    }
    if (!q) return out
    return out.filter((r) =>
      [
        r.nome_empresa,
        r.cnpj,
        r.phone,
        r.cliente_nome,
        r.problema_relatado,
        r.id_ligacao,
        r.id,
      ]
        .filter((v) => v != null && v !== '')
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [records, search, sentimentoFilter])

  const stats = useMemo(() => {
    const total = records.length
    const resolvidas = records.filter((r) => r.status === 'resolvida_ia').length
    const transferidas = records.filter((r) => r.status === 'transferida').length
    const interrompidas = records.filter((r) => r.status === 'interrompida').length
    const custoTotal = records.reduce((sum, r) => sum + (toNumber(r.custo_real) ?? 0), 0)
    return { total, resolvidas, transferidas, interrompidas, custoTotal }
  }, [records])

  return (
    <div>
      <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Atendimentos' }]} />

      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary">Atendimentos</h1>
          <p className="text-secondary mt-1">
            Registro das ligações atendidas pela Renata (Central IA)
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard icon={<Headphones size={18} />} label="Total" value={String(stats.total)} />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Resolvidas IA"
          value={String(stats.resolvidas)}
          accent="green"
        />
        <StatCard
          icon={<ArrowRightLeft size={18} />}
          label="Transferidas"
          value={String(stats.transferidas)}
          accent="yellow"
        />
        <StatCard
          icon={<XCircle size={18} />}
          label="Interrompidas"
          value={String(stats.interrompidas)}
          accent="red"
        />
        <StatCard
          icon={<DollarSign size={18} />}
          label="Custo total"
          value={formatCusto(stats.custoTotal)}
        />
      </div>

      {/* Filtros */}
      <div className="glass p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-muted text-xs uppercase tracking-wider">
          <Filter size={14} />
          Filtros
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-glass border border-glass-border rounded-xl px-3 py-1.5 text-sm text-primary outline-none focus:border-orange-500/40"
        >
          <option value="all">Todos status</option>
          <option value="transferida">Transferida</option>
          <option value="resolvida_ia">Resolvida IA</option>
          <option value="interrompida">Interrompida</option>
        </select>

        <select
          value={destinoFilter}
          onChange={(e) => setDestinoFilter(e.target.value as DestinoFilter)}
          className="bg-glass border border-glass-border rounded-xl px-3 py-1.5 text-sm text-primary outline-none focus:border-orange-500/40"
        >
          <option value="all">Todos destinos</option>
          <option value="servicedesk">ServiceDesk</option>
          <option value="financeiro">Financeiro</option>
        </select>

        <select
          value={sentimentoFilter}
          onChange={(e) => setSentimentoFilter(e.target.value as SentimentoFilter)}
          className="bg-glass border border-glass-border rounded-xl px-3 py-1.5 text-sm text-primary outline-none focus:border-orange-500/40"
        >
          <option value="all">Todos sentimentos</option>
          <option value="positivo">Positivo</option>
          <option value="neutro">Neutro</option>
          <option value="negativo">Negativo</option>
        </select>

        <input
          type="date"
          value={dayFilter}
          onChange={(e) => setDayFilter(e.target.value)}
          className="bg-glass border border-glass-border rounded-xl px-3 py-1.5 text-sm text-primary outline-none focus:border-orange-500/40 [color-scheme:dark]"
        />

        <select
          value={hourFilter}
          onChange={(e) => setHourFilter(e.target.value)}
          disabled={!dayFilter}
          title={!dayFilter ? 'Escolha um dia primeiro' : 'Faixa de hora'}
          className="bg-glass border border-glass-border rounded-xl px-3 py-1.5 text-sm text-primary outline-none focus:border-orange-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <option value="all">Dia todo</option>
          {Array.from({ length: 24 }).map((_, h) => {
            const from = String(h).padStart(2, '0')
            const to = String((h + 1) % 24).padStart(2, '0')
            return (
              <option key={h} value={String(h)}>
                {from}:00 – {to}:00
              </option>
            )
          })}
        </select>

        {dayFilter && (
          <button
            type="button"
            onClick={() => {
              setDayFilter('')
              setHourFilter('all')
            }}
            className="text-xs text-muted hover:text-primary underline underline-offset-2"
          >
            Limpar data
          </button>
        )}

        <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={comProblema}
            onChange={(e) => setComProblema(e.target.checked)}
            className="accent-orange-500"
          />
          Só com problema extraído
        </label>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empresa, CNPJ, telefone, ID da ligação..."
          className="flex-1 min-w-[200px] bg-glass border border-glass-border rounded-xl px-3 py-1.5 text-sm text-primary outline-none focus:border-orange-500/40 placeholder:text-muted"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass p-12 text-center">
          <Headphones size={32} className="mx-auto mb-3 text-muted" />
          <p className="text-primary font-medium mb-1">Nenhum atendimento encontrado</p>
          <p className="text-sm text-muted">
            Os atendimentos registrados pela Central IA aparecerão aqui.
          </p>
        </div>
      ) : (
        <AtendimentosList records={filtered} onSelect={openDetail} />
      )}

      <AtendimentoDetailModal
        record={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        avaliacoes={avaliacoes}
        loadingAvaliacoes={loadingAvaliacoes}
      />
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: 'green' | 'yellow' | 'red'
}) {
  const color =
    accent === 'green'
      ? 'text-green-400'
      : accent === 'yellow'
        ? 'text-yellow-400'
        : accent === 'red'
          ? 'text-red-400'
          : 'text-primary'

  return (
    <div className="glass p-4">
      <div className="flex items-center gap-2 mb-2 text-muted">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
    </div>
  )
}
