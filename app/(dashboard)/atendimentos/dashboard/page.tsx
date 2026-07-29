'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Spinner } from '@/components/ui/Spinner'
import { RefreshCw, Filter, ImageDown, FileDown } from 'lucide-react'
import { AtendimentosTabs } from '@/components/atendimentos/AtendimentosTabs'
import { KPICards } from '@/components/atendimentos/dashboard/KPICards'
import { StatusDonut } from '@/components/atendimentos/dashboard/StatusDonut'
import { DailyVolumeChart } from '@/components/atendimentos/dashboard/DailyVolumeChart'
import { MotivosBarList } from '@/components/atendimentos/dashboard/MotivosBarList'
import { WorstMotivosTable } from '@/components/atendimentos/dashboard/WorstMotivosTable'
import { motivoParaCodigo } from '@/lib/tipos-atendimento'

// Mesmos presets da Lista, com adições do critério da nova tela:
// "Hoje, 3 dias, 7 dias, último mês, intervalo personalizado".
type PeriodPreset = 'todos' | 'hoje' | 'ontem' | '3d' | '7d' | '15d' | 'mes' | 'custom'

// Filtros espelhados da aba Lista — pra que o dashboard mostre agregação
// sobre o MESMO conjunto que aparece na Lista.
type StatusFilter = 'all' | 'em_atendimento' | 'transferida' | 'resolvida_ia' | 'resolvido_parcialmente' | 'interrompida'
type DestinoFilter = 'all' | 'servicedesk' | 'financeiro' | 'comercial' | 'ouvidoria'
type TipoContatoFilter = 'all' | 'ligacao' | 'chat'
type SentimentoFilter = 'all' | 'positivo' | 'neutro' | 'negativo'

// Labels legíveis dos filtros, usados no cabeçalho dos exports.
const STATUS_LABELS: Record<string, string> = {
  em_atendimento: 'Em atendimento',
  transferida: 'Transferida',
  resolvida_ia: 'Resolvida IA',
  resolvido_parcialmente: 'Resolvido Parcialmente',
  interrompida: 'Interrompida',
}
const DESTINO_LABELS: Record<string, string> = {
  servicedesk: 'ServiceDesk',
  financeiro: 'Financeiro',
  comercial: 'Comercial',
  ouvidoria: 'Ouvidoria',
}

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

  // Resumo textual dos filtros ativos — vai no cabeçalho do export.
  const filtrosLabel = useMemo(() => {
    const partes: string[] = [`Período: ${periodLabel}`]
    if (statusFilter !== 'all') partes.push(`Status: ${STATUS_LABELS[statusFilter]}`)
    if (destinoFilter !== 'all') partes.push(`Destino: ${DESTINO_LABELS[destinoFilter]}`)
    if (tipoContatoFilter !== 'all')
      partes.push(`Tipo: ${tipoContatoFilter === 'ligacao' ? 'Ligação' : 'Chat'}`)
    if (sentimentoFilter !== 'all') partes.push(`Sentimento: ${sentimentoFilter}`)
    if (comProblema) partes.push('Só com problema extraído')
    return partes.join(' · ')
  }, [periodLabel, statusFilter, destinoFilter, tipoContatoFilter, sentimentoFilter, comProblema])

  // Sufixo de arquivo com o período, pra distinguir exports.
  const fileSuffix = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    const periodo = !fromDate
      ? 'todos'
      : !toDate || toDate === fromDate
        ? fromDate
        : `${fromDate}_${toDate}`
    return `${periodo}_${hoje}`
  }, [fromDate, toDate])

  const captureRef = useRef<HTMLDivElement>(null)
  const exportHeaderRef = useRef<HTMLDivElement>(null)
  const [exportando, setExportando] = useState(false)

  // Monta a URL da Lista pra um motivo clicado: leva o tipo_atendimento
  // correspondente + os mesmos filtros aplicados aqui no Dashboard. Motivos
  // sem código de tipo (categorias só do regex) retornam null — não clicáveis.
  const hrefParaMotivo = useCallback(
    (motivo: string, statusOverride?: StatusFilter): string | null => {
      const codigo = motivoParaCodigo(motivo)
      if (!codigo) return null
      const p = new URLSearchParams()
      p.set('tipo_atendimento', codigo)
      const status = statusOverride ?? statusFilter
      if (status !== 'all') p.set('status', status)
      if (destinoFilter !== 'all') p.set('destino', destinoFilter)
      if (tipoContatoFilter !== 'all') p.set('tipo_contato', tipoContatoFilter)
      if (sentimentoFilter !== 'all') p.set('sentimento', sentimentoFilter)
      if (comProblema) p.set('com_problema', 'true')
      if (fromDate) {
        p.set('from', fromDate)
        p.set('to', toDate || fromDate)
      }
      return `/atendimentos?${p.toString()}`
    },
    [statusFilter, destinoFilter, tipoContatoFilter, sentimentoFilter, comProblema, fromDate, toDate]
  )

  const baixar = useCallback((href: string, nome: string) => {
    const a = document.createElement('a')
    a.href = href
    a.download = nome
    document.body.appendChild(a)
    a.click()
    a.remove()
  }, [])

  const exportarImagem = useCallback(async () => {
    if (!captureRef.current) return
    setExportando(true)
    const header = exportHeaderRef.current
    if (header) header.style.display = 'block'
    try {
      // pixelRatio 2 pra sair nítido; fundo sólido pra não ficar transparente.
      // Duas passadas: a 1ª "aquece" o carregamento de fontes/estilos, que
      // o html-to-image às vezes perde no primeiro render.
      const opts = {
        pixelRatio: 2,
        backgroundColor: '#0f1720',
        cacheBust: true,
      }
      await toPng(captureRef.current, opts)
      const dataUrl = await toPng(captureRef.current, opts)
      baixar(dataUrl, `dashboard-atendimentos_${fileSuffix}.png`)
    } catch (e) {
      console.error('Falha ao gerar imagem:', e)
    } finally {
      if (header) header.style.display = 'none'
      setExportando(false)
    }
  }, [baixar, fileSuffix])

  const exportarMarkdown = useCallback(() => {
    const pct = (n: number, total: number) =>
      total > 0 ? `${Math.round((n / total) * 100)}%` : '—'
    const linhasMotivo = (arr: Array<{ motivo: string; count: number }>) =>
      arr.length
        ? arr.map((m) => `| ${m.motivo} | ${m.count} |`).join('\n')
        : '| — | 0 |'

    const md = `# Dashboard de Atendimentos

**${filtrosLabel}**

_Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}_
${data.truncated ? '\n> ⚠️ Volume alto: considerando os 500.000 atendimentos mais recentes do filtro.\n' : ''}
## Indicadores

| Indicador | Valor |
|---|---|
| Total no período | ${data.kpi.total} |
| Resolvidos | ${data.kpi.resolvidos} (${pct(data.kpi.resolvidos, data.kpi.total)}) |
| Resolvidos parcial. | ${data.kpi.parcialmente} (${pct(data.kpi.parcialmente, data.kpi.total)}) |
| Transferidos | ${data.kpi.transferidos} (${pct(data.kpi.transferidos, data.kpi.total)}) |
| % Resolução | ${data.kpi.percentualResolucao}% |

## Mais entraram em contato

| Motivo | Total |
|---|---|
${linhasMotivo(data.topMotivos)}

## Mais resolvidos pela IA

| Motivo | Resolvidos |
|---|---|
${linhasMotivo(data.mostResolvidos)}

## Mais transferidos

| Motivo | Transferidos |
|---|---|
${linhasMotivo(data.mostTransferidos)}

## Motivos com pior taxa de resolução

| Motivo | Total | Resolv. | Transf. | % Resol. |
|---|---|---|---|---|
${
      data.worstMotivos.length
        ? data.worstMotivos
            .map(
              (m) =>
                `| ${m.motivo} | ${m.total} | ${m.resolvidos} | ${m.transferidos} | ${m.percentual ?? 0}% |`
            )
            .join('\n')
        : '| — | 0 | 0 | 0 | — |'
    }
`
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    baixar(url, `dashboard-atendimentos_${fileSuffix}.md`)
    URL.revokeObjectURL(url)
  }, [data, filtrosLabel, fileSuffix, baixar])

  return (
    <div>
      <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Atendimentos' }, { label: 'Dashboard' }]} />

      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-display font-bold text-primary">Atendimentos</h1>
          <AtendimentosTabs />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportarImagem}
            disabled={loading || exportando}
            title="Salvar o dashboard como imagem PNG"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-glass border border-glass-border text-secondary hover:text-primary hover:border-orange-500/40 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <ImageDown size={14} />
            {exportando ? 'Gerando…' : 'Salvar imagem'}
          </button>
          <button
            type="button"
            onClick={exportarMarkdown}
            disabled={loading}
            title="Salvar os dados do dashboard em Markdown"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-glass border border-glass-border text-secondary hover:text-primary hover:border-orange-500/40 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <FileDown size={14} />
            Salvar Markdown
          </button>
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
      </div>

      <div ref={captureRef} className="rounded-2xl">
      {/* Título + filtros — oculto na tela, revelado só durante a captura
          da imagem (via exportHeaderRef) pra dar contexto no PNG. */}
      <div ref={exportHeaderRef} style={{ display: 'none' }} className="mb-4">
        <h2 className="text-lg font-bold text-primary">Dashboard de Atendimentos</h2>
        <p className="text-xs text-secondary mt-0.5">{filtrosLabel}</p>
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
              hrefFor={hrefParaMotivo}
            />
            <MotivosBarList
              items={data.mostResolvidos}
              title="Mais resolvidos pela IA"
              accent="green"
              emptyMessage="Nenhum atendimento resolvido no período."
              // Neste corte, força o status resolvido.
              hrefFor={(m) => hrefParaMotivo(m, 'resolvida_ia')}
            />
            <MotivosBarList
              items={data.mostTransferidos}
              title="Mais transferidos"
              accent="yellow"
              emptyMessage="Nenhuma transferência no período."
              hrefFor={(m) => hrefParaMotivo(m, 'transferida')}
            />
          </div>

          <WorstMotivosTable rows={data.worstMotivos} />
        </div>
      )}
      </div>
    </div>
  )
}

function formatBR(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-')
  if (!y || !m || !d) return yyyyMmDd
  return `${d}/${m}/${y}`
}
