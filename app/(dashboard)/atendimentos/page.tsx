'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Spinner } from '@/components/ui/Spinner'
import { AtendimentosList } from '@/components/atendimentos/AtendimentosList'
import { AtendimentoDetailModal } from '@/components/atendimentos/AtendimentoDetailModal'
import { AtendimentosTabs } from '@/components/atendimentos/AtendimentosTabs'
import { TIPO_ATENDIMENTO_LABELS } from '@/lib/tipos-atendimento'
import Link from 'next/link'
import {
  Headphones,
  CheckCircle2,
  CheckCheck,
  ArrowRightLeft,
  Filter,
  Percent,
  RefreshCw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  FileDown,
} from 'lucide-react'
import type { AtendimentoRecord, AvaliacaoAtendimentoRecord } from '@/lib/types'
import { atendimentosToMarkdown, type AtendimentoExport } from '@/lib/export-markdown'

const PAGE_SIZE = 30

type StatsResponse = {
  total: number
  em_atendimento: number
  resolvida_ia: number
  resolvido_parcialmente: number
  transferida: number
  interrompida: number
}

const STATS_EMPTY: StatsResponse = {
  total: 0,
  em_atendimento: 0,
  resolvida_ia: 0,
  resolvido_parcialmente: 0,
  transferida: 0,
  interrompida: 0,
}

type StatusFilter = 'all' | 'em_atendimento' | 'transferida' | 'resolvida_ia' | 'resolvido_parcialmente' | 'interrompida'
type DestinoFilter = 'all' | 'servicedesk' | 'financeiro' | 'comercial' | 'ouvidoria' | 'parametrizacao'
type SentimentoFilter = 'all' | 'positivo' | 'neutro' | 'negativo'
type TipoContatoFilter = 'all' | 'ligacao' | 'chat'
// Presets de período. 'custom' libera os inputs De/Até pro usuário editar.
// 'mes' = últimos 30 dias (renomeado de '30d' por critério de aceitação).
type PeriodPreset = 'todos' | 'hoje' | 'ontem' | '3d' | '7d' | '15d' | 'mes' | 'custom'

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
  useTime: boolean,
  fromTime: string,
  toTime: string
): { from?: string; to?: string } {
  if (!fromDay) return {}
  const endDay = toDay || fromDay
  const [start, end] = fromDay <= endDay ? [fromDay, endDay] : [endDay, fromDay]
  if (!useTime) {
    return {
      from: `${start}T00:00:00-03:00`,
      to: `${end}T23:59:59.999-03:00`,
    }
  }
  return {
    from: `${start}T${fromTime || '00:00'}:00-03:00`,
    // Sem hora final, inclui o dia inteiro. O backend considera o limite
    // final inclusivo, portanto um atendimento exatamente às 18:00 entra.
    to: `${end}T${toTime || '23:59'}:${toTime ? '00' : '59.999'}-03:00`,
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
  const [soValidados, setSoValidados] = useState(false)
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
  const [fromTime, setFromTime] = useState('')
  const [toTime, setToTime] = useState('')
  const [timeFilterEnabled, setTimeFilterEnabled] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [sentimentoFilter, setSentimentoFilter] = useState<SentimentoFilter>('all')
  const [pdvFilter, setPdvFilter] = useState('')
  // Classificação vinda do n8n (cadastros, pix, sped...). Vazio = todos.
  const [tipoAtendimentoFilter, setTipoAtendimentoFilter] = useState('')
  const [pdvOptions, setPdvOptions] = useState<string[]>([])
  const [subsetorFilter, setSubsetorFilter] = useState('')
  const [subsetorOptions, setSubsetorOptions] = useState<string[]>([])

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
        setFromTime('')
        setToTime('')
        setTimeFilterEnabled(false)
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

  // Seleção pra export Markdown.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/atendimentos/pdvs').then((response) => response.json()),
      fetch('/api/atendimentos/subsetores').then((response) => response.json()),
    ])
      .then(([pdvsData, subsetoresData]) => {
        if (Array.isArray(pdvsData?.pdvs)) setPdvOptions(pdvsData.pdvs)
        if (Array.isArray(subsetoresData?.subsetores)) setSubsetorOptions(subsetoresData.subsetores)
      })
      .catch(() => {})
  }, [])

  // Pré-aplica filtros vindos da URL (ex.: clique num motivo do Dashboard).
  // Lido do window no client pra não forçar Suspense/dynamic no prerender.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const status = sp.get('status')
    const destino = sp.get('destino')
    const tipoContato = sp.get('tipo_contato')
    const sentimento = sp.get('sentimento')
    const tipoAtend = sp.get('tipo_atendimento')
    const subsetor = sp.get('subsetor_nome')
    const comProb = sp.get('com_problema')
    const from = sp.get('from')
    const to = sp.get('to')

    if (status) setStatusFilter(status as StatusFilter)
    if (destino) setDestinoFilter(destino as DestinoFilter)
    if (tipoContato) setTipoContatoFilter(tipoContato as TipoContatoFilter)
    if (sentimento) setSentimentoFilter(sentimento as SentimentoFilter)
    if (tipoAtend) setTipoAtendimentoFilter(tipoAtend)
    if (subsetor) setSubsetorFilter(subsetor)
    if (comProb === 'true') setComProblema(true)
    if (from) {
      setPeriodPreset('custom')
      setFromDate(from)
      setToDate(to || from)
    }
    // Só na montagem — lê a URL uma vez.
  }, [])

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
    soValidados,
    fromDate,
    toDate,
    fromTime,
    toTime,
    timeFilterEnabled,
    sentimentoFilter,
    searchDebounced,
    pdvFilter,
    tipoAtendimentoFilter,
    subsetorFilter,
  ])

  // Constrói os params compartilhados entre /atendimentos e /atendimentos/stats
  const buildQueryParams = useCallback(
    (includePagination: boolean): URLSearchParams => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (destinoFilter !== 'all') params.set('destino', destinoFilter)
      if (tipoContatoFilter !== 'all') params.set('tipo_contato', tipoContatoFilter)
      if (sentimentoFilter !== 'all') params.set('sentimento', sentimentoFilter)
      if (pdvFilter) params.set('pdv', pdvFilter)
      if (tipoAtendimentoFilter) params.set('tipo_atendimento', tipoAtendimentoFilter)
      if (subsetorFilter) params.set('subsetor_nome', subsetorFilter)
      if (comProblema) params.set('com_problema', 'true')
      if (soValidados) params.set('validados', 'true')
      if (searchDebounced) params.set('search', searchDebounced)
      const { from, to } = buildDateRange(
        fromDate,
        toDate,
        timeFilterEnabled,
        fromTime,
        toTime
      )
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
      pdvFilter,
      tipoAtendimentoFilter,
      subsetorFilter,
      comProblema,
      soValidados,
      searchDebounced,
      fromDate,
      toDate,
      fromTime,
      toTime,
      timeFilterEnabled,
      page,
    ]
  )

  // `silent` evita acender o spinner que esconde a tabela — usado pelo
  // botão "Atualizar" pra não piscar o conteúdo entre fetches rápidos.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setLoadError('')
    try {
      const params = buildQueryParams(true)
      const res = await fetch(`/api/atendimentos?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Erro HTTP ${res.status}`)
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
    } catch (err) {
      setRecords([])
      setTotalPages(1)
      setTotalFiltered(0)
      setLoadError(err instanceof Error ? err.message : 'Não foi possível consultar os atendimentos.')
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
          resolvido_parcialmente: Number(data.resolvido_parcialmente) || 0,
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

  const handleListSelect = useCallback(
    (record: AtendimentoRecord) => {
      void openDetail(record)
    },
    [openDetail]
  )

  const handleCloseDetail = useCallback(() => {
    setSelected(null)
  }, [])

  const visibleRecords = records
  const registrosVisiveis = records

  const toggleSelecao = useCallback((record: AtendimentoRecord) => {
    setSelectedIds((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(record.id)) proximo.delete(record.id)
      else proximo.add(record.id)
      return proximo
    })
  }, [])

  // Marca/desmarca todos os visíveis da página.
  const toggleSelecaoPagina = useCallback(
    (marcar: boolean) => {
      setSelectedIds((atual) => {
        const proximo = new Set(atual)
        for (const r of registrosVisiveis) {
          if (marcar) proximo.add(r.id)
          else proximo.delete(r.id)
        }
        return proximo
      })
    },
    [registrosVisiveis]
  )

  const todosPaginaMarcados =
    registrosVisiveis.length > 0 && registrosVisiveis.every((r) => selectedIds.has(r.id))

  const linhasSelecionadas = selectedIds

  const baixarMd = useCallback((texto: string, nome: string) => {
    const blob = new Blob([texto], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nome
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [])

  // Conversa REAL de um chat, vinda do banco de mensagens (uma linha por
  // mensagem, sem agrupar consecutivas). Null pra ligação ou quando não há
  // mensagens — aí o markdown usa a transcrição gravada como fallback.
  const conversaReal = useCallback(async (a: AtendimentoRecord): Promise<string | null> => {
    if (a.tipo_contato !== 'chat') return null
    try {
      const r = await fetch(`/api/atendimentos/${a.id}/mensagens`)
      const j = await r.json()
      const msgs: Array<{
        remetente: string
        conteudo: string | null
        enviado_em: string | null
        url_imagem: string | null
        media_type: string | null
      }> = j?.mensagens ?? []
      if (!msgs.length) return null
      return msgs
        .map((m) => {
          const quem = m.remetente === 'cliente-nexus' ? 'Cliente' : 'Nexus'
          const hora = m.enviado_em
            ? new Date(m.enviado_em).toLocaleTimeString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                hour: '2-digit',
                minute: '2-digit',
              })
            : ''
          let texto = m.conteudo ?? ''
          if (m.url_imagem) {
            const anexo = `[${m.media_type || 'anexo'}] ${m.url_imagem}`
            texto = texto ? `${texto} ${anexo}` : anexo
          }
          return `${quem}${hora ? ` [${hora}]` : ''}: ${texto}`
        })
        .join('\n')
    } catch {
      return null
    }
  }, [])

  // Anexa a conversa real a cada registro (chats), em lotes pra não abrir
  // dezenas de requests de uma vez.
  const enriquecerComConversa = useCallback(
    async (regs: AtendimentoRecord[]): Promise<AtendimentoExport[]> => {
      const out: AtendimentoExport[] = regs.map((r) => ({ ...r }))
      const LOTE = 6
      for (let i = 0; i < out.length; i += LOTE) {
        const fatia = out.slice(i, i + LOTE)
        await Promise.all(
          fatia.map(async (r, j) => {
            const conv = await conversaReal(r)
            if (conv) out[i + j].conversa = conv
          })
        )
      }
      return out
    },
    [conversaReal]
  )

  // Exporta os selecionados (da página atual), com a conversa real.
  const exportarSelecionados = useCallback(async () => {
    const escolhidos = registrosVisiveis.filter((r) => selectedIds.has(r.id))
    if (escolhidos.length === 0) return
    setExportando(true)
    try {
      const enriquecidos = await enriquecerComConversa(escolhidos)
      const md = atendimentosToMarkdown(enriquecidos, `${escolhidos.length} atendimento(s) selecionado(s)`)
      baixarMd(md, `atendimentos_selecionados_${new Date().toISOString().slice(0, 10)}.md`)
    } finally {
      setExportando(false)
    }
  }, [registrosVisiveis, selectedIds, enriquecerComConversa, baixarMd])

  // Exporta TODOS do filtro atual — pagina o endpoint até o fim.
  const exportarTodos = useCallback(async () => {
    setExportando(true)
    try {
      const todos: AtendimentoRecord[] = []
      let pagina = 1
      for (;;) {
        const params = buildQueryParams(false)
        params.set('page', String(pagina))
        params.set('pageSize', '100')
        const res = await fetch(`/api/atendimentos?${params.toString()}`)
        const data = await res.json()
        const lote: AtendimentoRecord[] = data?.data ?? []
        todos.push(...lote)
        const totalPag = data?.totalPages ?? 1
        if (pagina >= totalPag || lote.length === 0) break
        pagina++
        if (pagina > 1000) break // trava de segurança
      }
      if (todos.length === 0) return
      const enriquecidos = await enriquecerComConversa(todos)
      const md = atendimentosToMarkdown(enriquecidos, `Todos do filtro — ${todos.length} atendimento(s)`)
      baixarMd(md, `atendimentos_todos_${new Date().toISOString().slice(0, 10)}.md`)
    } finally {
      setExportando(false)
    }
  }, [buildQueryParams, enriquecerComConversa, baixarMd])

  const hasRecords = records.length > 0
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
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={exportarSelecionados}
              title={`Exportar ${selectedIds.size} atendimento(s) selecionado(s) para Markdown`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors text-sm font-medium cursor-pointer"
            >
              <FileDown size={14} />
              Exportar selecionados ({selectedIds.size})
            </button>
          )}
          <button
            type="button"
            onClick={exportarTodos}
            disabled={exportando || !hasRecords}
            title="Exportar todos os atendimentos do filtro atual para Markdown"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-glass border border-glass-border text-secondary hover:text-primary hover:border-orange-500/40 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <FileDown size={14} />
            {exportando ? 'Exportando…' : 'Exportar todos'}
          </button>
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard icon={<Headphones size={18} />} label="Total" value={String(stats.total)} />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Resolvidas IA"
          value={String(stats.resolvida_ia)}
          accent="green"
        />
        <StatCard
          icon={<CheckCheck size={18} />}
          label="Resolvido Parcial."
          value={String(stats.resolvido_parcialmente)}
          accent="emerald"
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
        <StatCard
          icon={<Percent size={18} />}
          label="% Resol. + Parcial"
          value={
            stats.total > 0
              ? `${Math.round(((stats.resolvida_ia + stats.resolvido_parcialmente) / stats.total) * 100)}%`
              : '—'
          }
          accent="emerald"
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
          <option value="resolvido_parcialmente">Resolvido Parcialmente</option>
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
          <option value="comercial">Comercial</option>
          <option value="ouvidoria">Ouvidoria</option>
          <option value="parametrizacao">Parametrização</option>
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

        {/* Tipo de atendimento — classificação que o n8n grava em
            `tipo_atendimento`. Ordenado por label pra achar no olho. */}
        <select
          value={tipoAtendimentoFilter}
          onChange={(e) => setTipoAtendimentoFilter(e.target.value)}
          title="Tipo de atendimento"
          className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark] [&>option]:bg-base [&>option]:text-orange-400"
        >
          <option value="">Todos os tipos de atendimento</option>
          {Object.entries(TIPO_ATENDIMENTO_LABELS)
            .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
            .map(([codigo, label]) => (
              <option key={codigo} value={codigo}>
                {label}
              </option>
            ))}
        </select>

        {subsetorOptions.length > 0 && (
          <select
            value={subsetorFilter}
            onChange={(event) => setSubsetorFilter(event.target.value)}
            title="Subsetor do atendimento"
            className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark] [&>option]:bg-base [&>option]:text-orange-400"
          >
            <option value="">Todos os subsetores</option>
            {subsetorOptions.map((subsetor) => (
              <option key={subsetor} value={subsetor}>{subsetor}</option>
            ))}
          </select>
        )}

        {pdvOptions.length > 0 && (
          <select
            value={pdvFilter}
            onChange={(e) => setPdvFilter(e.target.value)}
            className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark] [&>option]:bg-base [&>option]:text-orange-400"
          >
            <option value="">Todos PDVs</option>
            {pdvOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}

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
          <option value="ontem">Ontem</option>
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

        {periodPreset !== 'todos' && (
          <div className="flex items-center gap-1.5">
            <label className="flex items-center gap-1.5 text-xs text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={timeFilterEnabled}
                onChange={(e) => setTimeFilterEnabled(e.target.checked)}
                className="accent-orange-500"
              />
              Filtrar horário
            </label>
            <span className="text-[10px] uppercase tracking-wider text-muted">Das</span>
            <input
              type="time"
              value={fromTime}
              onChange={(e) => setFromTime(e.target.value)}
              disabled={!fromDate || !timeFilterEnabled}
              title={timeFilterEnabled ? 'Hora inicial (vazio = 00:00)' : 'Ative “Filtrar horário”'}
              className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 disabled:opacity-40 [color-scheme:dark]"
            />
            <span className="text-[10px] uppercase tracking-wider text-muted">Até</span>
            <input
              type="time"
              value={toTime}
              onChange={(e) => setToTime(e.target.value)}
              disabled={!fromDate || !timeFilterEnabled}
              title={timeFilterEnabled ? 'Hora final (vazio = 23:59)' : 'Ative “Filtrar horário”'}
              className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 disabled:opacity-40 [color-scheme:dark]"
            />
          </div>
        )}

        {periodPreset !== 'todos' && (
          <button
            type="button"
            onClick={() => {
              setPeriodPreset('todos')
              setFromDate('')
              setToDate('')
              setFromTime('')
              setToTime('')
              setTimeFilterEnabled(false)
            }}
            className="text-xs text-muted hover:text-primary underline underline-offset-2"
          >
            Limpar data
          </button>
        )}

        {loadError && (
          <div className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            Falha ao consultar o banco: {loadError}
          </div>
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

        <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={soValidados}
            onChange={(e) => setSoValidados(e.target.checked)}
            className="accent-green-500"
          />
          Só validados
        </label>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empresa, CNPJ, telefone, ID ou validação..."
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
          <AtendimentosList
            records={visibleRecords}
            onSelect={handleListSelect}
            selectedIds={linhasSelecionadas}
            onToggle={toggleSelecao}
            onToggleAll={toggleSelecaoPagina}
            allSelected={todosPaginaMarcados}
          />
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
        onValidationSaved={(updated) => {
          // Atualiza o registro selecionado e a lista para que o chip
          // "Validado" apareça/desapareça sem precisar de refetch.
          setSelected(updated)
          setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        }}
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
  accent?: 'green' | 'yellow' | 'red' | 'blue' | 'emerald'
}) {
  const color =
    accent === 'green'
      ? 'text-green-400'
      : accent === 'emerald'
        ? 'text-emerald-300'
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
