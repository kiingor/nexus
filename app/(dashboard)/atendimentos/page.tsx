'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Spinner } from '@/components/ui/Spinner'
import { AtendimentosList } from '@/components/atendimentos/AtendimentosList'
import { AtendimentoDetailModal } from '@/components/atendimentos/AtendimentoDetailModal'
import Link from 'next/link'
import {
  Headphones,
  CheckCircle2,
  ArrowRightLeft,
  Filter,
  Percent,
  RefreshCw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { AtendimentoRecord, AvaliacaoAtendimentoRecord } from '@/lib/types'

const PAGE_SIZE = 30

type StatsResponse = {
  total: number
  em_atendimento: number
  resolvida_ia: number
  transferida: number
  interrompida: number
}

const STATS_EMPTY: StatsResponse = {
  total: 0,
  em_atendimento: 0,
  resolvida_ia: 0,
  transferida: 0,
  interrompida: 0,
}

type StatusFilter = 'all' | 'em_atendimento' | 'transferida' | 'resolvida_ia' | 'interrompida'
type DestinoFilter = 'all' | 'servicedesk' | 'financeiro'
type SentimentoFilter = 'all' | 'positivo' | 'neutro' | 'negativo'
type TipoContatoFilter = 'all' | 'ligacao' | 'chat'

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
  const [tipoContatoFilter, setTipoContatoFilter] = useState<TipoContatoFilter>('all')
  const [comProblema, setComProblema] = useState(false)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [dayFilter, setDayFilter] = useState('')
  const [hourFilter, setHourFilter] = useState<'all' | string>('all')
  const [sentimentoFilter, setSentimentoFilter] = useState<SentimentoFilter>('all')

  // Paginação
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalFiltered, setTotalFiltered] = useState(0)

  // Stats globais (todos os atendimentos respeitando filtros, sem paginação)
  const [stats, setStats] = useState<StatsResponse>(STATS_EMPTY)

  // Estado do botão "Atualizar" — só pra animar o ícone, não substitui
  // o spinner global (load silencioso evita "flash" da tabela).
  const [refreshing, setRefreshing] = useState(false)

  // Debounce da busca (evita request a cada tecla)
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  // Volta pra página 1 sempre que algum filtro muda
  useEffect(() => {
    setPage(1)
  }, [
    statusFilter,
    destinoFilter,
    tipoContatoFilter,
    comProblema,
    dayFilter,
    hourFilter,
    sentimentoFilter,
    searchDebounced,
  ])

  // Constrói os params compartilhados entre /atendimentos e /atendimentos/stats
  const buildQueryParams = useCallback(
    (includePagination: boolean): URLSearchParams => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (destinoFilter !== 'all') params.set('destino', destinoFilter)
      if (tipoContatoFilter !== 'all') params.set('tipo_contato', tipoContatoFilter)
      if (sentimentoFilter !== 'all') params.set('sentimento', sentimentoFilter)
      if (comProblema) params.set('com_problema', 'true')
      if (searchDebounced) params.set('search', searchDebounced)
      const { from, to } = buildDateRange(dayFilter, hourFilter)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (includePagination) {
        params.set('page', String(page))
        params.set('pageSize', String(PAGE_SIZE))
      }
      return params
    },
    [
      statusFilter,
      destinoFilter,
      tipoContatoFilter,
      sentimentoFilter,
      comProblema,
      searchDebounced,
      dayFilter,
      hourFilter,
      page,
    ]
  )

  // `silent` evita acender o spinner que esconde a tabela — usado pelo
  // botão "Atualizar" pra não piscar o conteúdo entre fetches rápidos.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = buildQueryParams(true)
      const res = await fetch(`/api/atendimentos?${params.toString()}`)
      const data = await res.json()
      // Resposta nova: { data, total, page, pageSize, totalPages }
      // Mantém retrocompatibilidade com formato array bruto, por segurança.
      if (Array.isArray(data)) {
        setRecords(data)
        setTotalPages(1)
        setTotalFiltered(data.length)
      } else {
        setRecords(Array.isArray(data?.data) ? data.data : [])
        setTotalPages(Number(data?.totalPages) || 1)
        setTotalFiltered(Number(data?.total) || 0)
      }
    } catch {
      setRecords([])
      setTotalPages(1)
      setTotalFiltered(0)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [buildQueryParams])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([load(true), loadStats()])
    } finally {
      setRefreshing(false)
    }
  // loadStats só é definida abaixo, mas ambas são useCallback estáveis —
  // o lint pega isso no segundo render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  const loadStats = useCallback(async () => {
    try {
      const params = buildQueryParams(false)
      const res = await fetch(`/api/atendimentos/stats?${params.toString()}`)
      const data = await res.json()
      if (data && typeof data === 'object' && !data.error) {
        setStats({
          total: Number(data.total) || 0,
          em_atendimento: Number(data.em_atendimento) || 0,
          resolvida_ia: Number(data.resolvida_ia) || 0,
          transferida: Number(data.transferida) || 0,
          interrompida: Number(data.interrompida) || 0,
        })
      }
    } catch {
      // mantém o último stats em caso de erro transitório
    }
  }, [buildQueryParams])

  useEffect(() => {
    load()
  }, [load])

  // Stats: recarrega quando filtros mudam, mas NÃO quando só a página muda.
  // Para isso, dependência é construída a partir dos params sem paginação.
  const statsKey = useMemo(
    () => buildQueryParams(false).toString(),
    [buildQueryParams]
  )
  useEffect(() => {
    loadStats()
    // statsKey é uma string serializada — quando ela muda, recarrega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsKey])

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

  // Filtragem agora é toda server-side; `records` já vem com a página
  // certa após aplicar todos os filtros. Mantemos só uma variável de
  // compatibilidade visual pra empty state.
  const hasRecords = records.length > 0
  const rangeStart = (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, totalFiltered)

  return (
    <div>
      <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Atendimentos' }]} />

      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary">Atendimentos</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            title="Atualizar lista e indicadores"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-glass border border-glass-border text-secondary hover:text-primary hover:border-orange-500/40 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <Link
            href="/atendimentos/gestor-prompt"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors text-sm font-medium"
          >
            <Sparkles size={14} />
            Gestor de Prompt
          </Link>
        </div>
      </div>

      {/* Stats — números globais respeitando os filtros atuais (todas as
          páginas, não só a atual). Vêm do endpoint /atendimentos/stats. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Headphones size={18} />} label="Total" value={String(stats.total)} />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Resolvidas IA"
          value={String(stats.resolvida_ia)}
          accent="green"
        />
        <StatCard
          icon={<ArrowRightLeft size={18} />}
          label="Transferidas"
          value={String(stats.transferida)}
          accent="yellow"
        />
        <StatCard
          icon={<Percent size={18} />}
          label="% Resolvidos"
          value={
            stats.total > 0
              ? `${Math.round((stats.resolvida_ia / stats.total) * 100)}%`
              : '—'
          }
          accent="green"
        />
      </div>

      {/* Filtros */}
      <div className="glass p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-muted text-xs uppercase tracking-wider">
          <Filter size={14} />
          Filtros
        </div>

        {/* Filtros: fundo preto + texto/números em laranja. As <option>
            também recebem bg-base text-orange-400 pra que o dropdown
            nativo do navegador siga o mesmo padrão visual. */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark] [&>option]:bg-base [&>option]:text-orange-400"
        >
          <option value="all">Todos status</option>
          <option value="em_atendimento">Em atendimento</option>
          <option value="transferida">Transferida</option>
          <option value="resolvida_ia">Resolvida IA</option>
          <option value="interrompida">Interrompida</option>
        </select>

        <select
          value={destinoFilter}
          onChange={(e) => setDestinoFilter(e.target.value as DestinoFilter)}
          className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark] [&>option]:bg-base [&>option]:text-orange-400"
        >
          <option value="all">Todos destinos</option>
          <option value="servicedesk">ServiceDesk</option>
          <option value="financeiro">Financeiro</option>
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
          className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark] [&>option]:bg-base [&>option]:text-orange-400"
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
          className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark]"
        />

        <select
          value={hourFilter}
          onChange={(e) => setHourFilter(e.target.value)}
          disabled={!dayFilter}
          title={!dayFilter ? 'Escolha um dia primeiro' : 'Faixa de hora'}
          className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 disabled:opacity-40 disabled:cursor-not-allowed [color-scheme:dark] [&>option]:bg-base [&>option]:text-orange-400"
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
          className="flex-1 min-w-[200px] bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 placeholder:text-white/70"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : !hasRecords ? (
        <div className="glass p-12 text-center">
          <Headphones size={32} className="mx-auto mb-3 text-muted" />
          <p className="text-primary font-medium mb-1">Nenhum atendimento encontrado</p>
          <p className="text-sm text-muted">
            Os atendimentos registrados pela Central IA aparecerão aqui.
          </p>
        </div>
      ) : (
        <>
          <AtendimentosList records={records} onSelect={openDetail} />
          <Pagination
            page={page}
            totalPages={totalPages}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            total={totalFiltered}
            onChange={setPage}
          />
        </>
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

// Constrói uma lista compacta de páginas a exibir, com ellipses.
// Ex: [1, 2, '...', 7, 8, 9, '...', 19, 20] para 20 páginas, atual=8.
function buildPageList(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: Array<number | 'ellipsis'> = []
  out.push(1)
  if (current > 4) out.push('ellipsis')
  const start = Math.max(2, current - 2)
  const end = Math.min(total - 1, current + 2)
  for (let i = start; i <= end; i++) out.push(i)
  if (current < total - 3) out.push('ellipsis')
  out.push(total)
  return out
}

function Pagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onChange,
}: {
  page: number
  totalPages: number
  rangeStart: number
  rangeEnd: number
  total: number
  onChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  const pageList = buildPageList(page, totalPages)

  return (
    <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
      <span className="text-xs text-muted">
        Mostrando{' '}
        <span className="text-primary font-medium">{rangeStart.toLocaleString('pt-BR')}</span>
        {'–'}
        <span className="text-primary font-medium">{rangeEnd.toLocaleString('pt-BR')}</span>
        {' de '}
        <span className="text-primary font-medium">{total.toLocaleString('pt-BR')}</span>
        {' atendimentos'}
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-glass-border bg-glass text-xs text-muted hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
          Anterior
        </button>

        {pageList.map((p, idx) =>
          p === 'ellipsis' ? (
            <span key={`e${idx}`} className="px-2 text-muted text-xs">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`min-w-[32px] px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                p === page
                  ? 'bg-orange-500/15 border border-orange-500/40 text-orange-300'
                  : 'border border-glass-border bg-glass text-muted hover:text-primary'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-glass-border bg-glass text-xs text-muted hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Próxima
          <ChevronRight size={14} />
        </button>
      </div>
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
  accent?: 'green' | 'yellow' | 'red' | 'blue'
}) {
  const color =
    accent === 'green'
      ? 'text-green-400'
      : accent === 'yellow'
        ? 'text-yellow-400'
        : accent === 'red'
          ? 'text-red-400'
          : accent === 'blue'
            ? 'text-blue-400'
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
