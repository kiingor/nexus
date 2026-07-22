'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Spinner } from '@/components/ui/Spinner'
import {
  RefreshCw,
  Filter,
  PhoneOff,
  MessageSquare,
  Clock,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
} from 'lucide-react'
import { AtendimentosTabs } from '@/components/atendimentos/AtendimentosTabs'
import { ConversaAbandonadaModal } from '@/components/atendimentos/ConversaAbandonadaModal'

// Presets pedidos pra esta tela. Mesma mecânica da Lista/Dashboard: o
// preset resolve De/Até, e "Personalizado" libera os inputs.
type PeriodPreset = 'hoje' | 'ontem' | '7d' | 'mes' | 'custom'

// Ordenação pela última mensagem da conversa.
type Ordem = 'recentes' | 'antigos'

const PAGE_SIZE = 30

type Abandonado = {
  cliente_id: string
  nome: string
  telefone: string | null
  cnpj: string | null
  pdv: string | null
  inicio: string
  fim: string
  total: number
  parado_minutos: number
  ultimo: 'cliente' | 'nexus'
}

// Quem falou por último separa dois casos bem diferentes: se foi o cliente,
// a IA deixou no vácuo; se foi a IA, o cliente é que não voltou.
type UltimoFiltro = 'todos' | 'cliente' | 'nexus'

type Resposta = {
  abandonados: Abandonado[]
  stats: { conversas: number; parados: number; atendimentos: number; abandonados: number }
  truncated: boolean
  error?: string
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function resolvePreset(preset: PeriodPreset): { from: string; to: string } | null {
  if (preset === 'custom') return null
  const hoje = new Date()
  const to = toLocalDateStr(hoje)
  if (preset === 'hoje') return { from: to, to }

  if (preset === 'ontem') {
    const ontem = new Date(hoje)
    ontem.setDate(ontem.getDate() - 1)
    const dia = toLocalDateStr(ontem)
    return { from: dia, to: dia }
  }

  const start = new Date(hoje)
  start.setDate(start.getDate() - (preset === '7d' ? 6 : 29))
  return { from: toLocalDateStr(start), to }
}

// Dias locais (UTC-3) viram instantes ISO pro filtro no servidor.
function buildIsoRange(fromDay: string, toDay: string): { from: string; to: string } | null {
  if (!fromDay) return null
  const [start, end] =
    !toDay || toDay === fromDay
      ? [fromDay, fromDay]
      : fromDay <= toDay
        ? [fromDay, toDay]
        : [toDay, fromDay]
  return { from: `${start}T00:00:00-03:00`, to: `${end}T23:59:59.999-03:00` }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatParado(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h${String(min % 60).padStart(2, '0')}`
  return `${Math.floor(h / 24)}d${h % 24}h`
}

// Mesma lógica de cor dos badges da Lista: quanto mais tempo parado, mais
// grave — dá pra varrer a coluna procurando o que passou do ponto.
function paradoBadge(min: number): string {
  if (min >= 240) return 'bg-red-500/10 text-red-400 border-red-500/30'
  if (min >= 120) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
  return 'bg-white/5 text-secondary border-glass-border'
}

export default function AbandonadosPage() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('hoje')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [data, setData] = useState<Resposta | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [selecionado, setSelecionado] = useState<Abandonado | null>(null)
  const [ordem, setOrdem] = useState<Ordem>('recentes')
  const [busca, setBusca] = useState('')
  const [ultimoFiltro, setUltimoFiltro] = useState<UltimoFiltro>('todos')
  const [page, setPage] = useState(1)
  const [selecao, setSelecao] = useState<Set<string>>(new Set())
  const [abrindo, setAbrindo] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  // Aplica o preset inicial (Hoje) no primeiro render.
  useEffect(() => {
    const r = resolvePreset('hoje')
    if (r) {
      setFromDate(r.from)
      setToDate(r.to)
    }
  }, [])

  const carregar = useCallback(
    async (silencioso = false) => {
      const range = buildIsoRange(fromDate, toDate)
      if (!range) return

      if (silencioso) setRefreshing(true)
      else setLoading(true)
      setErro(null)

      try {
        const qs = new URLSearchParams({ from: range.from, to: range.to })
        const r = await fetch(`/api/atendimentos/abandonados?${qs}`)
        const json: Resposta = await r.json()
        if (!r.ok) {
          setErro(json?.error ?? 'Falha ao carregar')
          setData(null)
          return
        }
        setData(json)
      } catch {
        setErro('Falha ao carregar')
        setData(null)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [fromDate, toDate]
  )

  useEffect(() => {
    if (fromDate) carregar()
  }, [fromDate, toDate, carregar])

  // Trocar de período descarta o aviso do disparo anterior.
  useEffect(() => {
    setResultado(null)
  }, [fromDate, toDate])

  const handlePresetChange = useCallback((preset: PeriodPreset) => {
    setPeriodPreset(preset)
    const r = resolvePreset(preset)
    if (r) {
      setFromDate(r.from)
      setToDate(r.to)
    }
  }, [])

  const stats = data?.stats

  // O servidor devolve por última mensagem desc; a ordenação e o recorte
  // de página são locais — a lista inteira já está em memória.
  const lista = useMemo(() => {
    const todos = data?.abandonados ?? []
    const base =
      ultimoFiltro === 'todos'
        ? todos
        : todos.filter((a) => a.ultimo === ultimoFiltro)

    // Busca local por empresa, telefone, CNPJ ou PDV. Dígitos são
    // comparados sem máscara, pra achar o CNPJ/telefone digitado de
    // qualquer jeito.
    const termo = busca.trim().toLowerCase()
    const digitos = termo.replace(/\D/g, '')
    const filtrada = termo
      ? base.filter((a) => {
          const texto = [a.nome, a.pdv, a.telefone, a.cnpj]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          if (texto.includes(termo)) return true
          if (!digitos) return false
          const nums = `${a.telefone ?? ''}${a.cnpj ?? ''}`.replace(/\D/g, '')
          return nums.includes(digitos)
        })
      : base

    return [...filtrada].sort((a, b) =>
      ordem === 'recentes'
        ? Date.parse(b.fim) - Date.parse(a.fim)
        : Date.parse(a.fim) - Date.parse(b.fim)
    )
  }, [data, ordem, busca, ultimoFiltro])

  const total = lista.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const rangeStart = total === 0 ? 0 : (pageSafe - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(pageSafe * PAGE_SIZE, total)
  const visiveis = lista.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)

  // Trocar período ou ordenação sempre volta pra primeira página, e a
  // seleção é descartada — os itens da tela mudaram. O aviso do disparo
  // NÃO é limpo aqui: remover os itens despachados também mexe em `data`,
  // e o aviso some sozinho depois da confirmação.
  useEffect(() => {
    setPage(1)
    setSelecao(new Set())
  }, [data, ordem])

  // Buscar não descarta a seleção — dá pra marcar alguns, buscar outro
  // nome e marcar mais antes de disparar.
  useEffect(() => {
    setPage(1)
  }, [busca, ultimoFiltro])

  const chaveDe = (a: Abandonado) => a.cliente_id

  function alternar(a: Abandonado) {
    setSelecao((atual) => {
      const proximo = new Set(atual)
      const k = chaveDe(a)
      if (proximo.has(k)) proximo.delete(k)
      else proximo.add(k)
      return proximo
    })
  }

  // Marca/desmarca só o que está visível na página atual.
  function alternarPagina(marcar: boolean) {
    setSelecao((atual) => {
      const proximo = new Set(atual)
      for (const a of visiveis) {
        if (marcar) proximo.add(chaveDe(a))
        else proximo.delete(chaveDe(a))
      }
      return proximo
    })
  }

  async function abrirOcorrencias() {
    const escolhidos = lista.filter((a) => selecao.has(chaveDe(a)))
    if (escolhidos.length === 0) return

    const ok = window.confirm(
      `Abrir ${escolhidos.length} ocorrência${escolhidos.length === 1 ? '' : 's'} na Agenda?\n\n` +
        'A IA vai gerar o motivo e o serviço realizado a partir de cada conversa. ' +
        'Isso cria o atendimento no Nexus e não tem desfazer.'
    )
    if (!ok) return

    setAbrindo(true)
    setResultado(null)
    try {
      const r = await fetch('/api/atendimentos/abandonados/ocorrencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientes: escolhidos.map((a) => ({
            cliente_id: a.cliente_id,
            inicio: a.inicio,
            fim: a.fim,
          })),
        }),
      })
      const json = await r.json().catch(() => ({}))

      if (!r.ok) {
        setResultado(json?.error ?? 'Falha ao abrir ocorrências')
        return
      }

      const criados = json?.resultado?.criados

      // Com a ocorrência aberta o atendimento passa a existir, então a
      // conversa deixa de ser abandonada — some da lista na hora, sem
      // esperar o refetch.
      const despachados = new Set(escolhidos.map(chaveDe))
      setData((atual) => {
        if (!atual) return atual
        const restantes = atual.abandonados.filter(
          (a) => !despachados.has(chaveDe(a))
        )
        return {
          ...atual,
          abandonados: restantes,
          stats: { ...atual.stats, abandonados: restantes.length },
        }
      })
      setSelecao(new Set())

      setResultado(
        `${json.enviados} ocorrência(s) aberta(s)${
          typeof criados === 'number' ? ` · ${criados} atendimento(s) criado(s)` : ''
        }. Conferindo com o servidor…`
      )

      // O n8n processa o lote em alguns segundos; só depois disso o refetch
      // reflete a realidade. Antes disso ele traria os itens de volta.
      window.setTimeout(() => {
        carregar(true)
        setResultado(null)
      }, 8000)
    } catch {
      setResultado('Falha ao abrir ocorrências')
    } finally {
      setAbrindo(false)
    }
  }

  const todosDaPaginaMarcados =
    visiveis.length > 0 && visiveis.every((a) => selecao.has(chaveDe(a)))

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Atendimentos' },
          { label: 'Abandonados' },
        ]}
      />

      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-display font-bold text-primary">Atendimentos</h1>
          <AtendimentosTabs />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={abrirOcorrencias}
            disabled={selecao.size === 0 || abrindo}
            title={
              selecao.size === 0
                ? 'Selecione ao menos uma conversa'
                : `Abrir ocorrência para ${selecao.size} conversa(s)`
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <FilePlus2 size={14} className={abrindo ? 'animate-pulse' : ''} />
            {abrindo ? 'Abrindo…' : `Abrir ocorrência${selecao.size > 0 ? ` (${selecao.size})` : ''}`}
          </button>
          <button
            type="button"
            onClick={() => carregar(true)}
            disabled={loading || refreshing}
          title="Atualizar lista"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-glass border border-glass-border text-secondary hover:text-primary hover:border-orange-500/40 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {resultado && (
        <div className="glass p-4 mb-4 text-sm text-orange-300">{resultado}</div>
      )}

      {/* Stats — só os dois números que importam nesta aba. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard
          icon={<MessageSquare size={18} />}
          label="Conversas no período"
          value={String(stats?.conversas ?? 0)}
        />
        <StatCard
          icon={<PhoneOff size={18} />}
          label="Abandonadas (sem resolução nem transferência)"
          value={String(stats?.abandonados ?? 0)}
          accent="red"
        />
      </div>

      {/* Filtros */}
      <div className="glass p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-muted text-xs uppercase tracking-wider">
          <Filter size={14} />
          Filtros
        </div>

        <select
          value={periodPreset}
          onChange={(e) => handlePresetChange(e.target.value as PeriodPreset)}
          title="Período pré-definido"
          className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark] [&>option]:bg-base [&>option]:text-orange-400"
        >
          <option value="hoje">Hoje</option>
          <option value="ontem">Ontem</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="mes">Último mês</option>
          <option value="custom">Personalizado</option>
        </select>

        {/* De / Até — editável apenas em "Personalizado"; nos demais mostra
            o range resolvido pelo preset. */}
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

        <select
          value={ultimoFiltro}
          onChange={(e) => setUltimoFiltro(e.target.value as UltimoFiltro)}
          title="Quem enviou a última mensagem da conversa"
          className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark] [&>option]:bg-base [&>option]:text-orange-400"
        >
          <option value="todos">Última mensagem: qualquer um</option>
          <option value="cliente">Cliente falou por último</option>
          <option value="nexus">Nexus falou por último</option>
        </select>

        <select
          value={ordem}
          onChange={(e) => setOrdem(e.target.value as Ordem)}
          title="Ordenação pela última mensagem"
          className="bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 [color-scheme:dark] [&>option]:bg-base [&>option]:text-orange-400"
        >
          <option value="recentes">Mais recentes primeiro</option>
          <option value="antigos">Mais antigos primeiro</option>
        </select>

        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar empresa, telefone, CNPJ ou PDV..."
          className="flex-1 min-w-[220px] bg-base border border-orange-500/30 rounded-xl px-3 py-1.5 text-sm text-orange-400 outline-none focus:border-orange-500/60 placeholder:text-white/70"
        />

        <span
          title="Critério fixo desta aba"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-orange-500/10 border-orange-500/30 text-orange-400"
        >
          <Clock size={11} />
          Paradas há mais de 1h
        </span>
      </div>

      {data?.truncated && (
        <p className="text-xs text-yellow-400 mb-4">
          Volume de mensagens acima do teto de leitura — o período pode estar incompleto.
          Prefira recortes menores.
        </p>
      )}

      {erro && <div className="glass p-6 mb-6 text-sm text-red-400">{erro}</div>}

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {!loading && !erro && lista.length === 0 && (
        <div className="glass p-12 text-center">
          <PhoneOff size={28} className="mx-auto mb-3 text-muted" />
          <p className="text-secondary">
            {busca.trim()
              ? `Nenhum resultado para "${busca.trim()}" neste período.`
              : 'Nenhum atendimento abandonado no período.'}
          </p>
        </div>
      )}

      {!loading && lista.length > 0 && (
        <>
          <div className="glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-glass-border text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-4 py-3 font-medium w-10">
                      <input
                        type="checkbox"
                        checked={todosDaPaginaMarcados}
                        onChange={(e) => alternarPagina(e.target.checked)}
                        title="Selecionar todos desta página"
                        className="accent-orange-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Empresa</th>
                    <th className="px-4 py-3 font-medium">Telefone</th>
                    <th className="px-4 py-3 font-medium">Mensagens</th>
                    <th className="px-4 py-3 font-medium">Início</th>
                    <th className="px-4 py-3 font-medium">Última mensagem</th>
                    <th className="px-4 py-3 font-medium">Quem falou por último</th>
                    <th className="px-4 py-3 font-medium">Parado há</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((a) => (
                    <tr
                      key={a.cliente_id + a.fim}
                      onClick={() => setSelecionado(a)}
                      className={`border-b border-glass-border/50 hover:bg-white/[0.02] cursor-pointer transition-colors ${
                        selecao.has(a.cliente_id) ? 'bg-orange-500/[0.06]' : ''
                      }`}
                    >
                      {/* O clique no checkbox não pode abrir o modal. */}
                      <td
                        className="px-4 py-3"
                        onClick={(e) => {
                          e.stopPropagation()
                          alternar(a)
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selecao.has(a.cliente_id)}
                          onChange={() => alternar(a)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-orange-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={12} className="text-muted shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm text-primary font-medium truncate">
                              {a.nome}
                            </p>
                            <p className="text-xs text-muted truncate">
                              {[a.pdv, a.cnpj].filter(Boolean).join(' · ') || '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-secondary font-mono">
                        {a.telefone ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-secondary">
                        <span className="inline-flex items-center gap-1.5">
                          <MessageSquare size={12} className="text-muted" />
                          {a.total}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-secondary whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar size={12} className="text-muted" />
                          {formatDate(a.inicio)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-secondary whitespace-nowrap">
                        {formatDate(a.fim)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          title={
                            a.ultimo === 'cliente'
                              ? 'O cliente mandou a última mensagem e ninguém respondeu'
                              : 'A IA respondeu por último e o cliente não voltou'
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            a.ultimo === 'cliente'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                          }`}
                        >
                          {a.ultimo === 'cliente' ? 'Cliente' : 'Nexus'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${paradoBadge(
                            a.parado_minutos
                          )}`}
                        >
                          <Clock size={11} />
                          {formatParado(a.parado_minutos)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={pageSafe}
            totalPages={totalPages}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            total={total}
            onChange={setPage}
          />

          <p className="mt-3 text-xs text-muted">
            Clique em uma linha pra ver a conversa.
          </p>
        </>
      )}

      <ConversaAbandonadaModal
        open={!!selecionado}
        onClose={() => setSelecionado(null)}
        cliente={selecionado}
      />
    </div>
  )
}

// Mesmo paginador da Lista: primeira/última sempre visíveis, com reticências
// em volta da janela atual.
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
        {' abandonados'}
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
