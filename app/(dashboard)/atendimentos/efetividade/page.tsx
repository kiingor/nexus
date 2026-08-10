'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  Clock,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react'
import { AtendimentosTabs } from '@/components/atendimentos/AtendimentosTabs'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Spinner } from '@/components/ui/Spinner'
import type { EfetividadeCaso, EfetividadeResultado } from '@/lib/efetividade'

type PeriodPreset = '7d' | '30d' | '90d' | 'todos' | 'custom'
type ApiResponse = EfetividadeResultado & {
  totalCasos: number
  truncated: boolean
}

const EMPTY: ApiResponse = {
  kpi: {
    clientesResolvidos: 0,
    clientesEfetivos: 0,
    clientesQueRetornaram: 0,
    ocorrenciasResolvidas: 0,
    taxaEfetividade: 0,
    taxaRetorno: 0,
    medianaRetornoSegundos: null,
  },
  casos: [],
  porDestino: [],
  totalCasos: 0,
  truncated: false,
}

const PAGE_SIZE = 20

function toLocalDateStr(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function resolvePreset(preset: PeriodPreset): { from: string; to: string } {
  if (preset === 'todos') return { from: '', to: '' }
  const today = new Date()
  const to = toLocalDateStr(today)
  const days = preset === '7d' ? 6 : preset === '90d' ? 89 : 29
  const start = new Date(today)
  start.setDate(start.getDate() - days)
  return { from: toLocalDateStr(start), to }
}

const INITIAL_RANGE = resolvePreset('30d')

function buildIsoRange(fromDay: string, toDay: string): { from?: string; to?: string } {
  if (!fromDay) return {}
  const start = !toDay || fromDay <= toDay ? fromDay : toDay
  const end = !toDay || fromDay <= toDay ? toDay || fromDay : fromDay
  return {
    from: `${start}T00:00:00-03:00`,
    to: `${end}T23:59:59.999-03:00`,
  }
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
}

function formatElapsed(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h`
  const days = seconds / 86400
  if (days < 30) return `${days < 10 ? days.toFixed(1) : Math.round(days)} dias`
  const months = days / 30
  return `${months < 10 ? months.toFixed(1) : Math.round(months)} meses`
}

function formatIdentifier(caso: EfetividadeCaso): string {
  const cnpj = String(caso.cnpj ?? '').replace(/\D/g, '')
  if (cnpj.length === 14) {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }
  return caso.telefone || caso.identificador
}

function destinoLabel(value: string | null): string {
  const labels: Record<string, string> = {
    servicedesk: 'ServiceDesk',
    financeiro: 'Financeiro',
    comercial: 'Comercial',
    ouvidoria: 'Ouvidoria',
    parametrizacao: 'Parametrização',
    sem_destino: 'Sem destino',
  }
  return labels[String(value || 'sem_destino').toLowerCase()] || value || 'Sem destino'
}

function KpiCard({
  icon,
  label,
  value,
  detail,
  accent = 'orange',
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail: string
  accent?: 'orange' | 'green' | 'yellow' | 'blue'
}) {
  const colors = {
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    green: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
    yellow: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    blue: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  }

  return (
    <div className="glass p-5 min-w-0">
      <div className={`inline-flex p-2 rounded-xl border ${colors[accent]}`}>{icon}</div>
      <p className="mt-4 text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 text-3xl font-display font-bold text-primary">{value}</p>
      <p className="mt-1 text-xs text-secondary">{detail}</p>
    </div>
  )
}

export default function EfetividadePage() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30d')
  const [fromDate, setFromDate] = useState(INITIAL_RANGE.from)
  const [toDate, setToDate] = useState(INITIAL_RANGE.to)
  const [data, setData] = useState<ApiResponse>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const handlePreset = useCallback((preset: PeriodPreset) => {
    setPeriodPreset(preset)
    if (preset !== 'custom') {
      const range = resolvePreset(preset)
      setFromDate(range.from)
      setToDate(range.to)
    }
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      const range = buildIsoRange(fromDate, toDate)
      if (range.from) params.set('from', range.from)
      if (range.to) params.set('to', range.to)
      const response = await fetch(`/api/atendimentos/efetividade?${params.toString()}`)
      const json = (await response.json()) as ApiResponse | { error: string }
      if (!response.ok || 'error' in json) {
        throw new Error('error' in json ? json.error : 'Não foi possível carregar a efetividade.')
      }
      setData(json)
    } catch (cause) {
      setData(EMPTY)
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a efetividade.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [fromDate, toDate])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => setPage(1), [search, data])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load(true)
    } finally {
      setRefreshing(false)
    }
  }, [load])

  const filteredCases = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return data.casos
    const digits = term.replace(/\D/g, '')
    return data.casos.filter((caso) => {
      const haystack = [
        caso.clienteNome,
        caso.cnpj,
        caso.telefone,
        caso.identificador,
        caso.resolvida.problema,
        caso.transferencia.problema,
        caso.transferencia.destino,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
      return haystack.includes(term) || (digits.length >= 4 && haystack.replace(/\D/g, '').includes(digits))
    })
  }, [data.casos, search])

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE))
  const visibleCases = filteredCases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const periodLabel = useMemo(() => {
    if (!fromDate) return 'Todo o período'
    const format = (value: string) => value.split('-').reverse().join('/')
    if (!toDate || fromDate === toDate) return format(fromDate)
    return `${format(fromDate)} a ${format(toDate)}`
  }, [fromDate, toDate])

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Atendimentos' },
          { label: 'Efetividade' },
        ]}
      />

      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-3xl font-display font-bold text-primary">Atendimentos</h1>
          <AtendimentosTabs />
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-glass border border-glass-border text-secondary hover:text-primary hover:border-orange-500/40 transition-colors text-sm font-medium disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      <section className="glass p-5 mb-5 overflow-hidden relative">
        <div className="absolute -right-14 -top-20 h-48 w-48 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-orange-400 text-xs uppercase tracking-[0.18em] font-semibold">
              <Target size={15} />
              Efetividade das resoluções
            </div>
            <h2 className="mt-2 text-xl font-display font-bold text-primary">
              Quem voltou depois de uma ocorrência resolvida e precisou ser transferido
            </h2>
            <p className="mt-2 text-sm leading-6 text-secondary">
              A taxa considera clientes identificáveis com ocorrência resolvida pela IA no período.
              O retorno pode acontecer depois do fim do período selecionado.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays size={15} className="text-muted" />
            <select
              value={periodPreset}
              onChange={(event) => handlePreset(event.target.value as PeriodPreset)}
              className="bg-base border border-orange-500/30 rounded-xl px-3 py-2 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark] [&>option]:bg-base"
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="todos">Todo o período</option>
              <option value="custom">Personalizado</option>
            </select>
            {periodPreset === 'custom' && (
              <>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="bg-base border border-orange-500/30 rounded-xl px-3 py-2 text-sm text-orange-400 outline-none [color-scheme:dark]"
                />
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(event) => setToDate(event.target.value)}
                  className="bg-base border border-orange-500/30 rounded-xl px-3 py-2 text-sm text-orange-400 outline-none [color-scheme:dark]"
                />
              </>
            )}
            <span className="px-3 py-2 rounded-xl bg-white/5 text-xs text-secondary">{periodLabel}</span>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="md" />
        </div>
      ) : error ? (
        <div className="glass p-8 text-center">
          <p className="text-red-300 font-medium">Não foi possível carregar os dados</p>
          <p className="text-sm text-muted mt-1">{error}</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              icon={<ShieldCheck size={18} />}
              label="Taxa de efetividade"
              value={`${data.kpi.taxaEfetividade.toLocaleString('pt-BR')}%`}
              detail={`${data.kpi.clientesEfetivos} clientes sem transferência posterior`}
              accent="green"
            />
            <KpiCard
              icon={<Users size={18} />}
              label="Clientes resolvidos"
              value={data.kpi.clientesResolvidos.toLocaleString('pt-BR')}
              detail={`${data.kpi.ocorrenciasResolvidas} ocorrências resolvidas no período`}
              accent="blue"
            />
            <KpiCard
              icon={<Target size={18} />}
              label="Retornaram e transferiram"
              value={data.kpi.clientesQueRetornaram.toLocaleString('pt-BR')}
              detail={`${data.kpi.taxaRetorno.toLocaleString('pt-BR')}% dos clientes resolvidos`}
              accent="yellow"
            />
            <KpiCard
              icon={<Clock size={18} />}
              label="Tempo mediano de retorno"
              value={formatElapsed(data.kpi.medianaRetornoSegundos)}
              detail="Da resolução até a transferência posterior"
            />
          </div>

          {data.truncated && (
            <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-sm text-amber-200">
              O volume é muito alto. Os indicadores consideram o limite de segurança e a tabela exibe os casos mais recentes.
            </div>
          )}

          <section className="glass overflow-hidden">
            <div className="p-5 border-b border-glass-border flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="font-display font-bold text-primary">Clientes com retorno transferido</h3>
                <p className="text-xs text-muted mt-1">
                  {filteredCases.length.toLocaleString('pt-BR')} de {data.totalCasos.toLocaleString('pt-BR')} clientes
                </p>
              </div>
              <label className="relative block w-full sm:w-80">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar cliente, CNPJ ou problema"
                  className="w-full bg-base border border-glass-border rounded-xl pl-9 pr-3 py-2 text-sm text-primary placeholder:text-muted outline-none focus:border-orange-500/50"
                />
              </label>
            </div>

            {visibleCases.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <ShieldCheck size={28} className="mx-auto text-emerald-300" />
                <p className="mt-3 text-primary font-medium">
                  {search ? 'Nenhum cliente encontrado' : 'Nenhum retorno transferido no período'}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {search
                    ? 'Tente outro nome, CNPJ, telefone ou termo.'
                    : 'As resoluções do período não tiveram transferência posterior registrada.'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px] text-sm">
                    <thead className="bg-white/[0.025] text-left text-[11px] uppercase tracking-wider text-muted">
                      <tr>
                        <th className="px-5 py-3 font-medium">Cliente</th>
                        <th className="px-5 py-3 font-medium">Ocorrência resolvida</th>
                        <th className="w-10 px-2 py-3" aria-label="Sequência" />
                        <th className="px-5 py-3 font-medium">Retorno transferido</th>
                        <th className="px-5 py-3 font-medium">Tempo até retorno</th>
                        <th className="px-5 py-3 font-medium text-right">Histórico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-glass-border">
                      {visibleCases.map((caso) => (
                        <tr key={caso.clienteKey} className="hover:bg-white/[0.025] transition-colors align-top">
                          <td className="px-5 py-4">
                            <p className="font-medium text-primary max-w-56 truncate" title={caso.clienteNome}>
                              {caso.clienteNome}
                            </p>
                            <p className="mt-1 text-xs font-mono text-muted">{formatIdentifier(caso)}</p>
                          </td>
                          <td className="px-5 py-4 max-w-72">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                                #{caso.resolvida.id}
                              </span>
                              <span className="text-xs text-muted">{formatDateTime(caso.resolvida.data)}</span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-secondary line-clamp-2" title={caso.resolvida.problema || ''}>
                              {caso.resolvida.problema || 'Motivo não informado'}
                            </p>
                          </td>
                          <td className="px-2 py-5 text-muted">
                            <ArrowRight size={16} />
                          </td>
                          <td className="px-5 py-4 max-w-72">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                                #{caso.transferencia.id}
                              </span>
                              <span className="text-xs text-muted">{formatDateTime(caso.transferencia.data)}</span>
                            </div>
                            <p className="mt-2 text-xs text-orange-300">{destinoLabel(caso.transferencia.destino)}</p>
                            <p className="mt-1 text-xs leading-5 text-secondary line-clamp-2" title={caso.transferencia.problema || ''}>
                              {caso.transferencia.problema || 'Motivo não informado'}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-orange-300 whitespace-nowrap">
                              <Clock size={13} />
                              {formatElapsed(caso.tempoAteRetornoSegundos)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right text-xs text-secondary whitespace-nowrap">
                            <p>{caso.ocorrenciasResolvidas} resolvida(s)</p>
                            <p className="mt-1 text-amber-300">{caso.retornosTransferidos} retorno(s)</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="p-4 border-t border-glass-border flex items-center justify-between gap-3">
                    <span className="text-xs text-muted">
                      Página {page} de {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 rounded-lg border border-glass-border text-xs text-secondary hover:text-primary disabled:opacity-40 cursor-pointer"
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 rounded-lg border border-glass-border text-xs text-secondary hover:text-primary disabled:opacity-40 cursor-pointer"
                      >
                        Próxima
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {data.porDestino.length > 0 && (
            <section className="glass p-5">
              <h3 className="font-display font-bold text-primary">Destino dos retornos</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.porDestino.map((item) => (
                  <div key={item.destino} className="rounded-xl border border-glass-border bg-white/[0.025] px-4 py-3">
                    <p className="text-xs text-muted">{destinoLabel(item.destino)}</p>
                    <p className="mt-1 text-xl font-bold text-primary">{item.count}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
