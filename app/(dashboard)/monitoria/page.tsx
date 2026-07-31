'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, Bot, ChevronDown, ChevronUp, CircleCheck,
  ClipboardCheck, Filter, RefreshCw, Search, Sparkles, UserRound, Users,
  ChevronLeft, ChevronRight, Eye,
} from 'lucide-react'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { GlassModal } from '@/components/ui/GlassModal'
import { Spinner } from '@/components/ui/Spinner'
import type { MonitoramentoNexusRecord } from '@/lib/types'

const CRITERIOS = [
  ['Clareza', 'avaliacao_clareza'],
  ['Empatia', 'avaliacao_empatia_e_tom'],
  ['Contexto', 'avaliacao_compreensao_do_contexto'],
  ['Próximos passos', 'avaliacao_adequacao_dos_proximos_passos'],
  ['Resolução', 'avaliacao_resolucao_ou_encaminhamento'],
] as const

const PAGE_SIZE = 6

function mediaNotaGeral(records: MonitoramentoNexusRecord[]): number | null {
  const nums = records.map(record => record.nota_geral).filter((nota): nota is number => nota != null)
  return nums.length ? nums.reduce((sum, n) => sum + n, 0) / nums.length : null
}

function normalizar(value: string | null | undefined) {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function nivel(record: MonitoramentoNexusRecord) {
  const nota = record.nota_geral ?? 0
  const prioridade = normalizar(record.prioridade)
  if (prioridade.includes('critic') || nota < 4) return 'critical'
  if (prioridade.includes('alt') || nota < 6) return 'warning'
  if (nota >= 8) return 'good'
  return 'neutral'
}

const tones = {
  good: { line: 'border-t-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', bar: 'bg-emerald-500' },
  warning: { line: 'border-t-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', bar: 'bg-amber-500' },
  critical: { line: 'border-t-red-500', text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', bar: 'bg-red-500' },
  neutral: { line: 'border-t-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', bar: 'bg-orange-500' },
}

export default function MonitoriaPage() {
  const [records, setRecords] = useState<MonitoramentoNexusRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [quality, setQuality] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [pages, setPages] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<MonitoramentoNexusRecord | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '500' })
      if (fromDate) params.set('from', `${fromDate}T00:00:00-03:00`)
      if (toDate || fromDate) params.set('to', `${toDate || fromDate}T23:59:59.999-03:00`)
      const res = await fetch(`/api/monitoria?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível carregar o monitoramento.')
      setRecords(Array.isArray(data) ? data : [])
    } catch (err) {
      setRecords([])
      setError(err instanceof Error ? err.message : 'Erro ao carregar os dados.')
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate])

  useEffect(() => { load() }, [load])

  const recordsWithAttendant = useMemo(() => records.filter(record => Boolean(record.atendente?.trim())), [records])
  const qualities = useMemo(() => Array.from(new Set(recordsWithAttendant.map(r => r.classificacao_qualidade).filter(Boolean) as string[])).sort(), [recordsWithAttendant])
  const filtered = useMemo(() => recordsWithAttendant.filter(record => {
    const haystack = normalizar([record.atendente, record.nome_cliente, record.cnpj_cliente, record.produto_ou_assunto, record.motivo_do_contato].filter(Boolean).join(' '))
    return (!search || haystack.includes(normalizar(search))) && (!quality || record.classificacao_qualidade === quality)
  }), [recordsWithAttendant, search, quality])

  const groups = useMemo(() => {
    const map = new Map<string, MonitoramentoNexusRecord[]>()
    for (const record of filtered) {
      const name = record.atendente?.trim() || 'Atendente não identificado'
      map.set(name, [...(map.get(name) || []), record])
    }
    return Array.from(map, ([name, items]) => ({ name, items, avg: mediaNotaGeral(items) })).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1))
  }, [filtered])

  const stats = useMemo(() => ({
    average: mediaNotaGeral(filtered),
    attendants: groups.length,
    total: filtered.length,
    alerts: filtered.filter(r => nivel(r) === 'critical' || nivel(r) === 'warning').length,
  }), [filtered, groups.length])

  return (
    <div>
      <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Monitoria' }]} />

      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">
            <Activity size={14} /> Qualidade de atendimento
          </div>
          <h1 className="font-display text-3xl font-bold text-primary">Monitoramento</h1>
          <p className="mt-1 text-secondary">Desempenho dos atendentes e análise detalhada de cada contato.</p>
        </div>
        <button onClick={load} disabled={loading} className="glass flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm text-secondary transition hover:border-orange-500/30 hover:text-primary disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={<Sparkles size={17} />} label="Média geral" value={stats.average == null ? '—' : stats.average.toFixed(1)} suffix="/ 10" accent />
        <Metric icon={<Users size={17} />} label="Atendentes" value={String(stats.attendants)} />
        <Metric icon={<ClipboardCheck size={17} />} label="Atendimentos" value={String(stats.total)} />
        <Metric icon={<AlertTriangle size={17} />} label="Pontos de atenção" value={String(stats.alerts)} danger={stats.alerts > 0} />
      </div>

      <div className="glass mb-5 flex flex-col gap-3 p-3 md:flex-row md:flex-wrap">
        <label className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar atendente, cliente, CNPJ ou assunto..." className="w-full rounded-xl border border-glass-border bg-white/[0.025] py-2.5 pl-10 pr-4 text-sm text-primary placeholder:text-muted focus:border-orange-500/40 focus:outline-none" />
        </label>
        <label className="relative md:w-64">
          <Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <select value={quality} onChange={e => setQuality(e.target.value)} className="w-full appearance-none rounded-xl border border-glass-border bg-surface py-2.5 pl-10 pr-4 text-sm text-secondary focus:border-orange-500/40 focus:outline-none">
            <option value="">Todas as classificações</option>
            {qualities.map(item => <option key={item}>{item}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted">De</span>
          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPages({}) }} className="rounded-xl border border-glass-border bg-surface px-3 py-2.5 text-sm text-secondary [color-scheme:dark] focus:border-orange-500/40 focus:outline-none" />
          <span className="text-[10px] uppercase tracking-wider text-muted">Até</span>
          <input type="date" value={toDate} min={fromDate || undefined} onChange={e => { setToDate(e.target.value); setPages({}) }} className="rounded-xl border border-glass-border bg-surface px-3 py-2.5 text-sm text-secondary [color-scheme:dark] focus:border-orange-500/40 focus:outline-none" />
          {(fromDate || toDate) && <button onClick={() => { setFromDate(''); setToDate(''); setPages({}) }} className="text-xs text-muted underline hover:text-primary">Limpar</button>}
        </div>
      </div>

      {loading ? <div className="flex justify-center py-20"><Spinner size="md" /></div>
        : error ? <Empty icon={<AlertTriangle size={30} />} title="Não foi possível carregar o monitoramento" description={error} />
        : groups.length === 0 ? <Empty icon={<ClipboardCheck size={30} />} title="Nenhum atendimento encontrado" description="Os registros da tabela monitoramento_nexus aparecerão aqui." />
        : <div className="space-y-5">{groups.map(group => {
          const expanded = open[group.name] ?? true
          const critical = group.items.filter(item => ['critical', 'warning'].includes(nivel(item))).length
          const totalPages = Math.max(1, Math.ceil(group.items.length / PAGE_SIZE))
          const page = Math.min(pages[group.name] || 1, totalPages)
          const visibleItems = group.items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
          return <section key={group.name} className="glass overflow-hidden border-t-2 border-t-orange-500">
            <button onClick={() => setOpen(prev => ({ ...prev, [group.name]: !expanded }))} className="flex w-full cursor-pointer items-center gap-4 p-5 text-left transition hover:bg-white/[0.02]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 font-display text-lg font-bold text-orange-400">{initials(group.name)}</div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-display text-xl font-bold text-primary">{group.name}</h2>
                  <span className="rounded-full border border-glass-border bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted">{group.items.length} atendimento{group.items.length === 1 ? '' : 's'}</span>
                  {critical > 0 && <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">{critical} {critical === 1 ? 'alerta' : 'alertas'}</span>}
                </div>
                <p className="line-clamp-1 text-sm text-secondary">{group.items[0]?.avaliacao_justificativa_resumida || group.items[0]?.resumo_executivo || 'Sem observação geral registrada.'}</p>
              </div>
              <div className="hidden text-right sm:block"><div className="font-display text-3xl font-bold text-orange-400">{group.avg == null ? '—' : group.avg.toFixed(1)}</div><div className="text-[10px] uppercase tracking-wider text-muted">média / 10</div></div>
              {expanded ? <ChevronUp className="text-muted" size={18} /> : <ChevronDown className="text-muted" size={18} />}
            </button>
            {expanded && <div className="border-t border-glass-border bg-black/10 p-3">
              <div className="grid gap-3 xl:grid-cols-2">{visibleItems.map(record => <AtendimentoCard key={record.id} record={record} onOpen={() => setSelected(record)} />)}</div>
              {totalPages > 1 && <div className="mt-3 flex items-center justify-end gap-2 border-t border-glass-border pt-3">
                <span className="mr-2 text-xs text-muted">Página {page} de {totalPages}</span>
                <button disabled={page === 1} onClick={() => setPages(prev => ({ ...prev, [group.name]: page - 1 }))} className="rounded-lg border border-glass-border p-1.5 text-secondary hover:text-primary disabled:opacity-30"><ChevronLeft size={15} /></button>
                <button disabled={page === totalPages} onClick={() => setPages(prev => ({ ...prev, [group.name]: page + 1 }))} className="rounded-lg border border-glass-border p-1.5 text-secondary hover:text-primary disabled:opacity-30"><ChevronRight size={15} /></button>
              </div>}
            </div>}
          </section>
        })}</div>}
      <MonitoriaModal record={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function AtendimentoCard({ record, onOpen }: { record: MonitoramentoNexusRecord; onOpen: () => void }) {
  const kind = nivel(record)
  const tone = tones[kind]
  const notaGeral = record.nota_geral
  const risks = Array.isArray(record.riscos_e_pontos_importantes) ? record.riscos_e_pontos_importantes.map(String).filter(Boolean) : []
  return <article onClick={onOpen} className={`group cursor-pointer rounded-2xl border border-glass-border border-t-2 ${tone.line} bg-surface/80 p-3 transition hover:border-orange-500/30`}>
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className={`mb-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] ${tone.bg} ${tone.border} ${tone.text}`}><Bot size={11} />{record.classificacao_qualidade || 'Sem classificação'}</div>
        <h3 className="truncate font-display text-base font-bold text-primary">{record.nome_cliente || 'Cliente não identificado'}</h3>
        <p className="mt-0.5 truncate text-xs text-muted">{record.produto_ou_assunto || record.motivo_do_contato || 'Assunto não informado'}{record.cnpj_cliente ? ` · ${formatDocument(record.cnpj_cliente)}` : ''}</p>
      </div>
      <div className="shrink-0 text-right"><span className={`font-display text-2xl font-bold ${tone.text}`}>{notaGeral == null ? '—' : notaGeral.toFixed(1)}</span><span className="ml-1 text-[10px] text-muted">/ 10</span><p className="text-[10px] text-muted">{formatDate(record.created_at)}</p></div>
    </div>

    <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-secondary">{record.avaliacao_justificativa_resumida || record.resumo_executivo || 'Sem observação registrada para este atendimento.'}</p>
    <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-2 border-y border-glass-border py-3 sm:grid-cols-5">
      {CRITERIOS.map(([label, key]) => <Score key={key} label={label} value={record[key]} tone={tone.bar} />)}
    </div>
    <div className="grid gap-2 sm:grid-cols-3">
      <Info label="Cliente" value={record.irritacao_nivel || 'Sem irritação'} detail={record.irritacao_evidencia_resumida} />
      <Info label="Motivo" value={record.motivo_do_contato || 'Não informado'} detail={record.motivo_identificado_corretamente_pelo_bot ? `Identificação: ${record.motivo_identificado_corretamente_pelo_bot}` : null} />
      <Info label={risks.length ? 'Risco' : 'Próxima ação'} value={risks[0] || record.proxima_acao_recomendada || 'Sem ação pendente'} detail={risks.slice(1).join(' · ') || null} />
    </div>
    <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted group-hover:text-orange-400"><Eye size={12} /> Ver detalhes completos</div>
  </article>
}

function Score({ label, value, tone }: { label: string; value: number | null; tone: string }) {
  return <div><div className="mb-1.5 flex items-center justify-between gap-1 text-[9px] text-muted"><span className="truncate">{label}</span><b className="text-primary">{value ?? '—'}</b></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${tone}`} style={{ width: `${value == null ? 0 : Math.max(0, Math.min(100, value * 20))}%` }} /></div></div>
}

function Info({ label, value, detail }: { label: string; value: string; detail?: string | null }) {
  return <div className="rounded-xl border border-glass-border bg-white/[0.025] p-3"><p className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em] text-muted">{label}</p><p className="line-clamp-2 text-xs font-semibold text-primary">{value}</p>{detail && <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted">{detail}</p>}</div>
}

function MonitoriaModal({ record, onClose }: { record: MonitoramentoNexusRecord | null; onClose: () => void }) {
  if (!record) return null
  const risks = Array.isArray(record.riscos_e_pontos_importantes) ? record.riscos_e_pontos_importantes.map(String).filter(Boolean) : []
  const language = Array.isArray(record.linguagem_inadequada_sequencias_relacionadas) ? record.linguagem_inadequada_sequencias_relacionadas.map(String).filter(Boolean) : []
  return <GlassModal open title={`Monitoria #${record.id} · ${record.nome_cliente || 'Cliente não identificado'}`} onClose={onClose} className="max-w-4xl">
    <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <FullField label="Atendente" value={record.atendente} />
        <FullField label="Data" value={new Date(record.created_at).toLocaleString('pt-BR')} />
        <FullField label="CNPJ/CPF" value={record.cnpj_cliente ? formatDocument(record.cnpj_cliente) : null} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <FullField label="Nota geral" value={record.nota_geral == null ? null : `${record.nota_geral} / 10`} />
        <FullField label="Classificação da qualidade" value={record.classificacao_qualidade} />
        <FullField label="Normalização" value={record.normalizacao_ok ? 'OK' : 'Com pendência'} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FullField label="Produto ou assunto" value={record.produto_ou_assunto} />
        <FullField label="Motivo do contato" value={record.motivo_do_contato} />
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        {CRITERIOS.map(([label, key]) => <FullField key={key} label={label} value={record[key] == null ? null : `${record[key]} / 5`} />)}
      </div>
      <FullField label="Justificativa da avaliação" value={record.avaliacao_justificativa_resumida} />
      <FullField label="Resumo executivo" value={record.resumo_executivo} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FullField label="Irritação do cliente" value={record.irritacao_nivel} detail={record.irritacao_evidencia_resumida} />
        <FullField label="Motivo identificado corretamente" value={record.motivo_identificado_corretamente_pelo_bot} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FullField label="Linguagem inadequada" value={record.linguagem_inadequada_identificada} detail={[record.linguagem_inadequada_tipo, ...language].filter(Boolean).join('\n')} />
        <FullField label="Prioridade" value={record.prioridade} />
      </div>
      {risks.length > 0 && <FullField label="Riscos e pontos importantes" value={risks.map((item, i) => `${i + 1}. ${item}`).join('\n')} />}
      {record.proxima_acao_recomendada && <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4"><CircleCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" /><FullField label="Próxima ação recomendada" value={record.proxima_acao_recomendada} plain /></div>}
    </div>
  </GlassModal>
}

function FullField({ label, value, detail, plain }: { label: string; value: string | null; detail?: string | null; plain?: boolean }) {
  return <div className={plain ? 'flex-1' : 'rounded-xl border border-glass-border bg-white/[0.025] p-3'}>
    <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-primary">{value || '—'}</p>
    {detail && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-secondary">{detail}</p>}
  </div>
}

function Metric({ icon, label, value, suffix, accent, danger }: { icon: React.ReactNode; label: string; value: string; suffix?: string; accent?: boolean; danger?: boolean }) {
  return <div className="glass p-4"><div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted">{icon}{label}</div><span className={`font-display text-2xl font-bold ${danger ? 'text-amber-400' : accent ? 'text-orange-400' : 'text-primary'}`}>{value}</span>{suffix && <span className="ml-1 text-xs text-muted">{suffix}</span>}</div>
}

function Empty({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="glass p-12 text-center"><div className="mx-auto mb-3 w-fit text-muted">{icon}</div><p className="font-medium text-primary">{title}</p><p className="mx-auto mt-1 max-w-lg text-sm text-muted">{description}</p></div>
}

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || <UserRound size={18} /> }
function formatDate(iso: string) { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) }
function formatDocument(value: string) { const digits = value.replace(/\D/g, ''); return digits.length === 14 ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : value }
