'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Spinner } from '@/components/ui/Spinner'
import { AtendimentosList } from '@/components/atendimentos/AtendimentosList'
import { AtendimentoDetailModal } from '@/components/atendimentos/AtendimentoDetailModal'
import { AtendimentosTabs } from '@/components/atendimentos/AtendimentosTabs'
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

// Janela usada pra agrupar atendimentos consecutivos da mesma empresa
// (mesmo CNPJ) quando o gap entre o fim de um e o início do próximo for
// menor que isso. Acontece quando o cliente liga/conversa em sequência.
const MERGE_WINDOW_MS = 5 * 60 * 1000

export type MergedAtendimento = AtendimentoRecord & {
  /** 1 = sem agrupamento; > 1 indica quantos atendimentos formam essa linha. */
  mergedCount: number
  /** IDs originais (ordem cronológica ascendente). */
  mergedIds: number[]
  /** Registros originais (ordem cronológica ascendente). */
  mergedRecords: AtendimentoRecord[]
}

function arrivalMs(r: AtendimentoRecord): number {
  const s = r.data_hora_chegada ?? r.criado_em ?? ''
  const t = Date.parse(s)
  return Number.isNaN(t) ? 0 : t
}

function departureMs(r: AtendimentoRecord): number {
  const s = r.data_hora_saida ?? r.data_hora_chegada ?? r.criado_em ?? ''
  const t = Date.parse(s)
  return Number.isNaN(t) ? 0 : t
}

function buildMergedAtendimento(group: AtendimentoRecord[]): MergedAtendimento {
  if (group.length === 1) {
    return {
      ...group[0],
      mergedCount: 1,
      mergedIds: [group[0].id],
      mergedRecords: group,
    }
  }
  const first = group[0]
  const last = group[group.length - 1]
  // Soma de duração quando todos têm valor; senão deixa null.
  const allHaveDur = group.every((r) => typeof r.duracao_segundos === 'number')
  const totalDur = allHaveDur
    ? group.reduce((s, r) => s + (r.duracao_segundos ?? 0), 0)
    : null

  // PDV: se todos os atendimentos unidos tiverem o mesmo PDV (ou apenas
  // um deles tiver valor), preserva. Se variar, marca como "Vários PDVs".
  const distinctPdvs = Array.from(
    new Set(group.map((r) => (r.pdv ?? '').trim()).filter(Boolean))
  )
  const mergedPdv =
    distinctPdvs.length === 0
      ? null
      : distinctPdvs.length === 1
        ? distinctPdvs[0]
        : 'Vários PDVs'

  return {
    // Base = último atendimento (status / destino / sentimento mais recentes).
    ...last,
    // Datas: começo do mais antigo, saída do mais recente.
    data_hora_chegada: first.data_hora_chegada,
    data_hora_saida: last.data_hora_saida,
    duracao_segundos: totalDur,
    pdv: mergedPdv,
    mergedCount: group.length,
    mergedIds: group.map((r) => r.id),
    mergedRecords: group,
  }
}

/**
 * Agrupa atendimentos consecutivos da mesma empresa (mesmo CNPJ) quando o
 * gap entre o fim do anterior e o início do próximo for < MERGE_WINDOW_MS.
 *
 * Atendimentos sem CNPJ NÃO agrupam — cada um vira sua própria linha.
 *
 * Limitação consciente: o agrupamento opera sobre o array recebido (a
 * página atual). Um grupo que atravessa fronteira de página aparecerá
 * dividido — o backend é quem pagina, então corrigir isso exigiria mudança
 * lá. Não é o caso comum, deixa pra depois.
 */
function mergeAtendimentosByCnpj(records: AtendimentoRecord[]): MergedAtendimento[] {
  const withCnpj: AtendimentoRecord[] = []
  const withoutCnpj: AtendimentoRecord[] = []
  for (const r of records) {
    if (r.cnpj && r.cnpj.trim()) withCnpj.push(r)
    else withoutCnpj.push(r)
  }

  const byCnpj = new Map<string, AtendimentoRecord[]>()
  for (const r of withCnpj) {
    const key = (r.cnpj as string).trim()
    const list = byCnpj.get(key)
    if (list) list.push(r)
    else byCnpj.set(key, [r])
  }

  const out: MergedAtendimento[] = []
  for (const list of byCnpj.values()) {
    list.sort((a, b) => arrivalMs(a) - arrivalMs(b))
    let group: AtendimentoRecord[] = []
    for (const r of list) {
      if (group.length === 0) { group.push(r); continue }
      const prev = group[group.length - 1]
      const gap = arrivalMs(r) - departureMs(prev)
      if (Number.isFinite(gap) && gap >= 0 && gap < MERGE_WINDOW_MS) {
        group.push(r)
      } else {
        out.push(buildMergedAtendimento(group))
        group = [r]
      }
    }
    if (group.length) out.push(buildMergedAtendimento(group))
  }

  for (const r of withoutCnpj) out.push(buildMergedAtendimento([r]))

  // Mantém a ordem visual atual (mais recente primeiro).
  out.sort((a, b) => departureMs(b) - departureMs(a))
  return out
}

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
// Presets de período. 'custom' libera os inputs De/Até pro usuário editar.
// 'mes' = últimos 30 dias (renomeado de '30d' por critério de aceitação).
type PeriodPreset = 'todos' | 'hoje' | '3d' | '7d' | '15d' | 'mes' | 'custom'

// Converte um Date local pra string YYYY-MM-DD (formato esperado pelo input
// type="date"). Usa componentes locais — NÃO toISOString — pra evitar drift
// de timezone (que jogaria pro dia anterior em fusos atrás de UTC).
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// Resolve um preset em {from, to}. 'todos' devolve datas vazias (sem filtro).
// 'custom' devolve null pra sinalizar "não tocar nas datas atuais".
function resolvePreset(preset: PeriodPreset): { from: string; to: string } | null {
  if (preset === 'custom') return null
  if (preset === 'todos') return { from: '', to: '' }
  const today = new Date()
  const to = toLocalDateStr(today)
  if (preset === 'hoje') return { from: to, to }
  const daysBack =
    preset === '3d' ? 2 : preset === '7d' ? 6 : preset === '15d' ? 14 : 29 // 'mes'
  const start = new Date(today)
  start.setDate(start.getDate() - daysBack)
  return { from: toLocalDateStr(start), to }
}

// Constrói o intervalo [from, to) no fuso UTC-3 (horário de Brasília).
//
// Lógica:
// - `fromDay` vazio → ignora tudo, retorna {}.
// - `fromDay` + `toDay` (≠ fromDay) → intervalo abrangendo de 00:00 do
//   primeiro dia até 23:59:59.999 do último. Hora é IGNORADA num período.
// - Só `fromDay` (ou fromDay === toDay) → dia único, respeita `hour`
//   como antes.
function buildDateRange(
  fromDay: string,
  toDay: string,
  hour: string
): { from?: string; to?: string } {
  if (!fromDay) return {}

  // Período (dois dias diferentes) — ignora hour
  if (toDay && toDay !== fromDay) {
    // Garante from <= to mesmo se o usuário inverter a ordem
    const [start, end] = fromDay <= toDay ? [fromDay, toDay] : [toDay, fromDay]
    return {
      from: `${start}T00:00:00-03:00`,
      to: `${end}T23:59:59.999-03:00`,
    }
  }

  // Dia único com hour="all" → dia inteiro
  if (hour === 'all' || hour === '') {
    return {
      from: `${fromDay}T00:00:00-03:00`,
      to: `${fromDay}T23:59:59.999-03:00`,
    }
  }

  // Dia único com hora específica
  const h = Number(hour)
  const nextH = h + 1
  const pad = (n: number) => String(n).padStart(2, '0')
  if (nextH >= 24) {
    // Última faixa 23:00 → próximo dia 00:00
    const d = new Date(`${fromDay}T00:00:00-03:00`)
    d.setDate(d.getDate() + 1)
    const nextDay = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    return {
      from: `${fromDay}T23:00:00-03:00`,
      to: `${nextDay}T00:00:00-03:00`,
    }
  }
  return {
    from: `${fromDay}T${pad(h)}:00:00-03:00`,
    to: `${fromDay}T${pad(nextH)}:00:00-03:00`,
  }
}

export default function AtendimentosPage() {
  const [records, setRecords] = useState<AtendimentoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AtendimentoRecord | null>(null)
  // Grupo de atendimentos unidos que originou o `selected`. Vazio para
  // atendimentos não-unidos (modal renderiza sem abas).
  const [selectedGroup, setSelectedGroup] = useState<AtendimentoRecord[]>([])
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoAtendimentoRecord[]>([])
  const [loadingAvaliacoes, setLoadingAvaliacoes] = useState(false)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [destinoFilter, setDestinoFilter] = useState<DestinoFilter>('all')
  const [tipoContatoFilter, setTipoContatoFilter] = useState<TipoContatoFilter>('all')
  const [comProblema, setComProblema] = useState(false)
  // Filtro client-side: mostra só grupos resultantes do agrupamento por CNPJ
  // (mais de um atendimento unido). Como o agrupamento é client-side,
  // este filtro também tem que ser — não vai pro server e não reseta página.
  const [soUnidos, setSoUnidos] = useState(false)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  // Preset de período (Hoje, 7/15/30 dias, Todos, Personalizado). Quando
  // muda, atualiza fromDate/toDate automaticamente. 'custom' libera os
  // inputs De/Até pra edição manual.
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('todos')
  const [fromDate, setFromDate] = useState('')
  // Data final do período. Vazio = filtra apenas pelo dia em `fromDate`.
  // Quando preenchido e diferente de `fromDate`, vira intervalo e o filtro
  // de hora abaixo é ignorado pela query (e desabilitado no UI).
  const [toDate, setToDate] = useState('')
  const [hourFilter, setHourFilter] = useState<'all' | string>('all')
  const [sentimentoFilter, setSentimentoFilter] = useState<SentimentoFilter>('all')

  // Aplica um preset de período. Para 'custom', mantém as datas atuais
  // (apenas habilita a edição manual). Para os demais, calcula e seta.
  const handlePresetChange = useCallback((preset: PeriodPreset) => {
    setPeriodPreset(preset)
    const range = resolvePreset(preset)
    if (range) {
      setFromDate(range.from)
      setToDate(range.to)
      // Em período de vários dias, hour não se aplica.
      if (range.from && range.to && range.from !== range.to) {
        setHourFilter('all')
      }
    }
  }, [])

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
    fromDate,
    toDate,
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
      const { from, to } = buildDateRange(fromDate, toDate, hourFilter)
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
      fromDate,
      toDate,
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

  // Chamado pela tabela: registra o grupo de unidos (pra alimentar as abas
  // do modal) e abre o detalhe do registro "base" (mais recente).
  // O parâmetro é tipado como AtendimentoRecord & extras opcionais pra
  // bater com a assinatura genérica da AtendimentosList (a runtime sempre
  // vem como MergedAtendimento porque visibleRecords é MergedAtendimento[]).
  const handleListSelect = useCallback(
    (record: AtendimentoRecord & Partial<MergedAtendimento>) => {
      setSelectedGroup(record.mergedRecords ?? [record])
      void openDetail(record)
    },
    [openDetail]
  )

  // Limpa estado ao fechar — modal não deve "lembrar" do grupo anterior.
  const handleCloseDetail = useCallback(() => {
    setSelected(null)
    setSelectedGroup([])
  }, [])

  // Agrupa atendimentos consecutivos da mesma empresa (gap < 5min) numa
  // única linha. Roda em cima do que veio da página atual.
  const mergedRecords = useMemo(() => mergeAtendimentosByCnpj(records), [records])

  // Aplica o filtro client-side "Só unidos" em cima do resultado do merge.
  const visibleRecords = useMemo(
    () => (soUnidos ? mergedRecords.filter((r) => r.mergedCount > 1) : mergedRecords),
    [mergedRecords, soUnidos]
  )

  // Filtragem (server-side) já trouxe a página certa. `hasRecords` reflete
  // o que o servidor mandou; `noUnidosOnPage` cobre o caso em que o filtro
  // client-side de unidos zerou a página atual.
  const hasRecords = records.length > 0
  const noUnidosOnPage = hasRecords && soUnidos && visibleRecords.length === 0
  const rangeStart = (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, totalFiltered)

  return (
    <div>
      <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Atendimentos' }]} />

      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-display font-bold text-primary">Atendimentos</h1>
          <AtendimentosTabs />
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

        {/* Preset de período. Define rapidamente o intervalo De/Até.
            "Personalizado" libera os inputs abaixo pra edição manual. */}
        <select
          value={periodPreset}
          onChange={(e) => handlePresetChange(e.target.value as PeriodPreset)}
          title="Período pré-definido"
          className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark] [&>option]:bg-base [&>option]:text-orange-400"
        >
          <option value="todos">Todo o período</option>
          <option value="hoje">Hoje</option>
          <option value="3d">Últimos 3 dias</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="15d">Últimos 15 dias</option>
          <option value="mes">Último mês</option>
          <option value="custom">Personalizado</option>
        </select>

        {/* De / Até — só aparece quando há período selecionado. Editável
            apenas no modo "Personalizado"; nos demais mostra (read-only) o
            range resolvido pelo preset. */}
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
              title={
                periodPreset !== 'custom'
                  ? 'Selecione "Personalizado" pra editar'
                  : !fromDate
                    ? 'Escolha a data inicial primeiro'
                    : 'Data final do período'
              }
              min={fromDate || undefined}
              className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 disabled:opacity-60 disabled:cursor-not-allowed [color-scheme:dark]"
            />
          </div>
        )}

        {(() => {
          const isPeriodo = !!toDate && toDate !== fromDate
          const hourDisabled = !fromDate || isPeriodo
          const hourTitle = !fromDate
            ? 'Escolha um dia primeiro'
            : isPeriodo
              ? 'Filtro de hora indisponível em período (vários dias)'
              : 'Faixa de hora'
          return (
            <select
              value={isPeriodo ? 'all' : hourFilter}
              onChange={(e) => setHourFilter(e.target.value)}
              disabled={hourDisabled}
              title={hourTitle}
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
          )
        })()}

        {periodPreset !== 'todos' && (
          <button
            type="button"
            onClick={() => {
              setPeriodPreset('todos')
              setFromDate('')
              setToDate('')
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

        <label
          title="Mostrar só atendimentos da mesma empresa unidos por proximidade (<5min). Filtro local sobre a página atual."
          className="flex items-center gap-2 text-sm text-secondary cursor-pointer select-none"
        >
          <input
            type="checkbox"
            checked={soUnidos}
            onChange={(e) => setSoUnidos(e.target.checked)}
            className="accent-orange-500"
          />
          Só unidos
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
      ) : noUnidosOnPage ? (
        <div className="glass p-12 text-center">
          <Headphones size={32} className="mx-auto mb-3 text-muted" />
          <p className="text-primary font-medium mb-1">Nenhum atendimento unido nesta página</p>
          <p className="text-sm text-muted">
            O agrupamento é feito sobre os atendimentos da página atual. Tente
            navegar em outras páginas ou desmarcar "Só unidos".
          </p>
        </div>
      ) : (
        <>
          <AtendimentosList records={visibleRecords} onSelect={handleListSelect} />
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
        onClose={handleCloseDetail}
        avaliacoes={avaliacoes}
        loadingAvaliacoes={loadingAvaliacoes}
        group={selectedGroup}
        onSelectRecord={openDetail}
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
