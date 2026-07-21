'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Spinner } from '@/components/ui/Spinner'
import { RefreshCw, Filter } from 'lucide-react'
import { AtendimentosTabs } from '@/components/atendimentos/AtendimentosTabs'
import { KPICards } from '@/components/atendimentos/dashboard/KPICards'
import { StatusDonut } from '@/components/atendimentos/dashboard/StatusDonut'
import { DailyVolumeChart } from '@/components/atendimentos/dashboard/DailyVolumeChart'
import { MotivosBarList } from '@/components/atendimentos/dashboard/MotivosBarList'
import { WorstMotivosTable } from '@/components/atendimentos/dashboard/WorstMotivosTable'

// Mesmos presets da Lista, com adições do critério da nova tela:
// "Hoje, 3 dias, 7 dias, último mês, intervalo personalizado".
type PeriodPreset = 'todos' | 'hoje' | 'ontem' | '3d' | '7d' | '15d' | 'mes' | 'custom'

// Filtros espelhados da aba Lista — pra que o dashboard mostre agregação
// sobre o MESMO conjunto que aparece na Lista.
type StatusFilter = 'all' | 'em_atendimento' | 'transferida' | 'resolvida_ia' | 'resolvido_parcialmente' | 'interrompida'
type DestinoFilter = 'all' | 'servicedesk' | 'financeiro' | 'comercial' | 'ouvidoria'
type TipoContatoFilter = 'all' | 'ligacao' | 'chat'
type SentimentoFilter = 'all' | 'positivo' | 'neutro' | 'negativo'

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function resolvePreset(preset: PeriodPreset): { from: string; to: string } | null {
  if (preset === 'custom') return null
  if (preset === 'todos') return { from: '', to: '' }
  const today = new Date()
  const to = toLocalDateStr(today)
  if (preset === 'hoje') return { from: to, to }

  // Ontem é dia único (De = Até), não um intervalo até hoje.
  if (preset === 'ontem') {
    const ontem = new Date(today)
    ontem.setDate(ontem.getDate() - 1)
    const dia = toLocalDateStr(ontem)
    return { from: dia, to: dia }
  }

  const daysBack =
    preset === '3d' ? 2 : preset === '7d' ? 6 : preset === '15d' ? 14 : 29 // 'mes'
  const start = new Date(today)
  start.setDate(start.getDate() - daysBack)
  return { from: toLocalDateStr(start), to }
}

function buildIsoRange(fromDay: string, toDay: string): { from?: string; to?: string } {
  if (!fromDay) return {}
  const [start, end] = !toDay || toDay === fromDay
    ? [fromDay, fromDay]
    : fromDay <= toDay
      ? [fromDay, toDay]
      : [toDay, fromDay]
  return {
    from: `${start}T00:00:00-03:00`,
    to: `${end}T23:59:59.999-03:00`,
  }
}

type DashboardResponse = {
  kpi: {
    total: number
    resolvidos: number
    parcialmente: number
    transferidos: number
    em_atendimento: number
    interrompida: number
    percentualResolucao: number
  }
  byStatus: Array<{ status: string; count: number }>
  byDay: Array<{ date: string; resolvidos: number; parcialmente: number; transferidos: number; outros: number }>
  topMotivos: Array<{ motivo: string; count: number }>
  mostResolvidos: Array<{ motivo: string; count: number }>
  mostTransferidos: Array<{ motivo: string; count: number }>
  worstMotivos: Array<{
    motivo: string
    total: number
    resolvidos: number
    parcialmente: number
    transferidos: number
    finalizados: number
    percentual: number | null
  }>
  truncated: boolean
}

const EMPTY: DashboardResponse = {
  kpi: { total: 0, resolvidos: 0, parcialmente: 0, transferidos: 0, em_atendimento: 0, interrompida: 0, percentualResolucao: 0 },
  byStatus: [],
  byDay: [],
  topMotivos: [],
  mostResolvidos: [],
  mostTransferidos: [],
  worstMotivos: [],
  truncated: false,
}

export default function AtendimentosDashboardPage() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('7d')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [destinoFilter, setDestinoFilter] = useState<DestinoFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [tipoContatoFilter, setTipoContatoFilter] = useState<TipoContatoFilter>('all')
  const [sentimentoFilter, setSentimentoFilter] = useState<SentimentoFilter>('all')
  const [comProblema, setComProblema] = useState(false)
  const [data, setData] = useState<DashboardResponse>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Aplica o preset inicial (Últimos 7 dias) no primeiro render.
  useEffect(() => {
    const r = resolvePreset('7d')
    if (r) {
      setFromDate(r.from)
      setToDate(r.to)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePresetChange = useCallback((preset: PeriodPreset) => {
    setPeriodPreset(preset)
    const r = resolvePreset(preset)
    if (r) {
      setFromDate(r.from)
      setToDate(r.to)
    }
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams()
      const { from, to } = buildIsoRange(fromDate, toDate)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (destinoFilter !== 'all') params.set('destino', destinoFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (tipoContatoFilter !== 'all') params.set('tipo_contato', tipoContatoFilter)
      if (sentimentoFilter !== 'all') params.set('sentimento', sentimentoFilter)
      if (comProblema) params.set('com_problema', 'true')
      const res = await fetch(`/api/atendimentos/dashboard?${params.toString()}`)
      const json = (await res.json()) as DashboardResponse | { error: string }
      if ('error' in json) {
        setData(EMPTY)
      } else {
        setData(json)
      }
    } catch {
      setData(EMPTY)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [fromDate, toDate, destinoFilter, statusFilter, tipoContatoFilter, sentimentoFilter, comProblema])

  useEffect(() => {
    void load()
  }, [load])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load(true)
    } finally {
      setRefreshing(false)
    }
  }, [load])

  const periodLabel = useMemo(() => {
    if (!fromDate) return 'Todo o período'
    if (!toDate || toDate === fromDate) return `Dia ${formatBR(fromDate)}`
    return `${formatBR(fromDate)} a ${formatBR(toDate)}`
  }, [fromDate, toDate])

  return (
    <div>
      <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Atendimentos' }, { label: 'Dashboard' }]} />

      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-display font-bold text-primary">Atendimentos</h1>
          <AtendimentosTabs />
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          title="Atualizar dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-glass border border-glass-border text-secondary hover:text-primary hover:border-orange-500/40 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Filtros temporais + destino */}
      <div className="glass p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-muted text-xs uppercase tracking-wider">
          <Filter size={14} />
          Filtros
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          title="Status"
          className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark] [&>option]:bg-base [&>option]:text-orange-400"
        >
          <option value="all">Todos status</option>
          <option value="em_atendimento">Em atendimento</option>
          <option value="transferida">Transferida</option>
          <option value="resolvida_ia">Resolvida IA</option>
          <option value="resolvido_parcialmente">Resolvido Parcialmente</option>
          <option value="interrompida">Interrompida</option>
        </select>

        <select
          value={destinoFilter}
          onChange={(e) => setDestinoFilter(e.target.value as DestinoFilter)}
          title="Destino"
          className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark] [&>option]:bg-base [&>option]:text-orange-400"
        >
          <option value="all">Todos destinos</option>
          <option value="servicedesk">ServiceDesk</option>
          <option value="financeiro">Financeiro</option>
          <option value="comercial">Comercial</option>
          <option value="ouvidoria">Ouvidoria</option>
        </select>

        <select
          value={tipoContatoFilter}
          onChange={(e) => setTipoContatoFilter(e.target.value as TipoContatoFilter)}
          title="Tipo de contato"
          className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark] [&>option]:bg-base [&>option]:text-orange-400"
        >
          <option value="all">Todos tipos</option>
          <option value="ligacao">Ligação</option>
          <option value="chat">Chat</option>
        </select>

        <select
          value={sentimentoFilter}
          onChange={(e) => setSentimentoFilter(e.target.value as SentimentoFilter)}
          title="Sentimento"
          className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark] [&>option]:bg-base [&>option]:text-orange-400"
        >
          <option value="all">Todos sentimentos</option>
          <option value="positivo">Positivo</option>
          <option value="neutro">Neutro</option>
          <option value="negativo">Negativo</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={comProblema}
            onChange={(e) => setComProblema(e.target.checked)}
            className="accent-orange-500"
          />
          Só com problema extraído
        </label>

        <select
          value={periodPreset}
          onChange={(e) => handlePresetChange(e.target.value as PeriodPreset)}
          className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark] [&>option]:bg-base [&>option]:text-orange-400"
        >
          <option value="todos">Todo o período</option>
          <option value="hoje">Hoje</option>
          <option value="ontem">Ontem</option>
          <option value="3d">Últimos 3 dias</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="15d">Últimos 15 dias</option>
          <option value="mes">Último mês</option>
          <option value="custom">Personalizado</option>
        </select>

        {periodPreset !== 'todos' && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted">De</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              disabled={periodPreset !== 'custom'}
              className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 disabled:opacity-60 disabled:cursor-not-allowed [color-scheme:dark]"
            />
            <span className="text-[10px] uppercase tracking-wider text-muted">Até</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              disabled={periodPreset !== 'custom' || !fromDate}
              min={fromDate || undefined}
              className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 disabled:opacity-60 disabled:cursor-not-allowed [color-scheme:dark]"
            />
          </div>
        )}

        <span className="text-xs text-muted ml-auto">
          Mostrando: <span className="text-primary font-medium">{periodLabel}</span>
        </span>
      </div>

      {/* Aviso quando o servidor truncou os dados (acima de 500k registros) */}
      {data.truncated && (
        <div className="mb-4 px-4 py-2 rounded-xl text-xs bg-yellow-500/10 border border-yellow-500/25 text-yellow-300">
          O período selecionado tem volume muito alto. O dashboard está considerando os 500.000 atendimentos mais recentes do filtro.
          Aplique mais filtros pra reduzir o conjunto.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : (
        <div className="space-y-6">
          <KPICards
            total={data.kpi.total}
            resolvidos={data.kpi.resolvidos}
            parcialmente={data.kpi.parcialmente}
            transferidos={data.kpi.transferidos}
            percentualResolucao={data.kpi.percentualResolucao}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
            <StatusDonut data={data.byStatus} />
            <DailyVolumeChart data={data.byDay} />
          </div>

          {/* Três cortes do mesmo eixo "motivos de contato" lado a lado.
              Em telas pequenas, empilham verticalmente. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <MotivosBarList
              items={data.topMotivos}
              title="Mais entraram em contato"
              accent="orange"
            />
            <MotivosBarList
              items={data.mostResolvidos}
              title="Mais resolvidos pela IA"
              accent="green"
              emptyMessage="Nenhum atendimento resolvido no período."
            />
            <MotivosBarList
              items={data.mostTransferidos}
              title="Mais transferidos"
              accent="yellow"
              emptyMessage="Nenhuma transferência no período."
            />
          </div>

          <WorstMotivosTable rows={data.worstMotivos} />
        </div>
      )}
    </div>
  )
}

function formatBR(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-')
  if (!y || !m || !d) return yyyyMmDd
  return `${d}/${m}/${y}`
}
