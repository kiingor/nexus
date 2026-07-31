'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, Bot, ChevronDown, ChevronUp, CircleCheck,
  ClipboardCheck, Filter, RefreshCw, Search, Sparkles, UserRound, Users,
} from 'lucide-react'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Spinner } from '@/components/ui/Spinner'
import type { MonitoramentoNexusRecord } from '@/lib/types'

const CRITERIOS = [
  ['Clareza', 'avaliacao_clareza'],
  ['Empatia', 'avaliacao_empatia_e_tom'],
  ['Contexto', 'avaliacao_compreensao_do_contexto'],
  ['Próximos passos', 'avaliacao_adequacao_dos_proximos_passos'],
  ['Resolução', 'avaliacao_resolucao_ou_encaminhamento'],
] as const

function valores(record: MonitoramentoNexusRecord): number[] {
  return CRITERIOS.map(([, key]) => record[key]).filter((n): n is number => n != null)
}

function mediaRecord(record: MonitoramentoNexusRecord): number | null {
  const nums = valores(record)
  return nums.length ? nums.reduce((sum, n) => sum + n, 0) / nums.length : null
}

function media(records: MonitoramentoNexusRecord[]): number {
  const nums = records.flatMap(valores)
  return nums.length ? nums.reduce((sum, n) => sum + n, 0) / nums.length : 0
}

function normalizar(value: string | null | undefined) {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function nivel(record: MonitoramentoNexusRecord) {
  const avg = mediaRecord(record) ?? 0
  const prioridade = normalizar(record.prioridade)
  if (prioridade.includes('critic') || avg < 2) return 'critical'
  if (prioridade.includes('alt') || avg < 3) return 'warning'
  if (avg >= 4) return 'good'
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

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/monitoria?limit=500', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível carregar o monitoramento.')
      setRecords(Array.isArray(data) ? data : [])
    } catch (err) {
      setRecords([])
      setError(err instanceof Error ? err.message : 'Erro ao carregar os dados.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const qualities = useMemo(() => Array.from(new Set(records.map(r => r.classificacao_qualidade).filter(Boolean) as string[])).sort(), [records])
  const filtered = useMemo(() => records.filter(record => {
    const haystack = normalizar([record.atendente, record.nome_cliente, record.cnpj_cliente, record.produto_ou_assunto, record.motivo_do_contato].filter(Boolean).join(' '))
    return (!search || haystack.includes(normalizar(search))) && (!quality || record.classificacao_qualidade === quality)
  }), [records, search, quality])

  const groups = useMemo(() => {
    const map = new Map<string, MonitoramentoNexusRecord[]>()
    for (const record of filtered) {
      const name = record.atendente?.trim() || 'Atendente não identificado'
      map.set(name, [...(map.get(name) || []), record])
    }
    return Array.from(map, ([name, items]) => ({ name, items, avg: media(items) })).sort((a, b) => b.avg - a.avg)
  }, [filtered])

  const stats = useMemo(() => ({
    average: media(filtered),
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
        <Metric icon={<Sparkles size={17} />} label="Média dos critérios" value={stats.average ? stats.average.toFixed(1) : '—'} suffix="/ 5" accent />
        <Metric icon={<Users size={17} />} label="Atendentes" value={String(stats.attendants)} />
        <Metric icon={<ClipboardCheck size={17} />} label="Atendimentos" value={String(stats.total)} />
        <Metric icon={<AlertTriangle size={17} />} label="Pontos de atenção" value={String(stats.alerts)} danger={stats.alerts > 0} />
      </div>

      <div className="glass mb-6 flex flex-col gap-3 p-3 md:flex-row">
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
      </div>

      {loading ? <div className="flex justify-center py-20"><Spinner size="md" /></div>
        : error ? <Empty icon={<AlertTriangle size={30} />} title="Não foi possível carregar o monitoramento" description={error} />
        : groups.length === 0 ? <Empty icon={<ClipboardCheck size={30} />} title="Nenhum atendimento encontrado" description="Os registros da tabela monitoramento_nexus aparecerão aqui." />
        : <div className="space-y-5">{groups.map(group => {
          const expanded = open[group.name] ?? true
          const critical = group.items.filter(item => ['critical', 'warning'].includes(nivel(item))).length
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
              <div className="hidden text-right sm:block"><div className="font-display text-3xl font-bold text-orange-400">{group.avg.toFixed(1)}</div><div className="text-[10px] uppercase tracking-wider text-muted">média / 5</div></div>
              {expanded ? <ChevronUp className="text-muted" size={18} /> : <ChevronDown className="text-muted" size={18} />}
            </button>
            {expanded && <div className="grid gap-4 border-t border-glass-border bg-black/10 p-4 xl:grid-cols-2">{group.items.map(record => <AtendimentoCard key={record.id} record={record} />)}</div>}
          </section>
        })}</div>}
    </div>
  )
}

function AtendimentoCard({ record }: { record: MonitoramentoNexusRecord }) {
  const kind = nivel(record)
  const tone = tones[kind]
  const avg = mediaRecord(record)
  const risks = Array.isArray(record.riscos_e_pontos_importantes) ? record.riscos_e_pontos_importantes.map(String).filter(Boolean) : []
  return <article className={`rounded-2xl border border-glass-border border-t-2 ${tone.line} bg-surface/80 p-4 shadow-xl shadow-black/5`}>
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className={`mb-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] ${tone.bg} ${tone.border} ${tone.text}`}><Bot size={11} />{record.classificacao_qualidade || 'Sem classificação'}</div>
        <h3 className="truncate font-display text-lg font-bold text-primary">{record.nome_cliente || 'Cliente não identificado'}</h3>
        <p className="mt-0.5 truncate text-xs text-muted">{record.produto_ou_assunto || record.motivo_do_contato || 'Assunto não informado'}{record.cnpj_cliente ? ` · ${formatDocument(record.cnpj_cliente)}` : ''}</p>
      </div>
      <div className="shrink-0 text-right"><span className={`font-display text-3xl font-bold ${tone.text}`}>{avg?.toFixed(1) || '—'}</span><span className="ml-1 text-[10px] text-muted">/ 5</span><p className="mt-0.5 text-[10px] text-muted">{formatDate(record.created_at)}</p></div>
    </div>

    <p className="mb-4 min-h-10 text-sm leading-relaxed text-secondary">{record.avaliacao_justificativa_resumida || record.resumo_executivo || 'Sem observação registrada para este atendimento.'}</p>
    <div className="mb-4 grid grid-cols-2 gap-x-3 gap-y-3 border-y border-glass-border py-4 sm:grid-cols-5">
      {CRITERIOS.map(([label, key]) => <Score key={key} label={label} value={record[key]} tone={tone.bar} />)}
    </div>
    <div className="grid gap-2 sm:grid-cols-3">
      <Info label="Cliente" value={record.irritacao_nivel || 'Sem irritação'} detail={record.irritacao_evidencia_resumida} />
      <Info label="Motivo" value={record.motivo_do_contato || 'Não informado'} detail={record.motivo_identificado_corretamente_pelo_bot ? `Identificação: ${record.motivo_identificado_corretamente_pelo_bot}` : null} />
      <Info label={risks.length ? 'Risco' : 'Próxima ação'} value={risks[0] || record.proxima_acao_recomendada || 'Sem ação pendente'} detail={risks.slice(1).join(' · ') || null} />
    </div>
    {record.proxima_acao_recomendada && risks.length > 0 && <div className={`mt-3 flex items-start gap-2 rounded-xl border p-3 ${tone.bg} ${tone.border}`}><CircleCheck size={14} className={`mt-0.5 shrink-0 ${tone.text}`} /><div><p className="text-[9px] font-bold uppercase tracking-wider text-muted">Próxima ação recomendada</p><p className="mt-0.5 text-xs text-primary">{record.proxima_acao_recomendada}</p></div></div>}
  </article>
}

function Score({ label, value, tone }: { label: string; value: number | null; tone: string }) {
  return <div><div className="mb-1.5 flex items-center justify-between gap-1 text-[9px] text-muted"><span className="truncate">{label}</span><b className="text-primary">{value ?? '—'}</b></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${tone}`} style={{ width: `${value == null ? 0 : Math.max(0, Math.min(100, value * 20))}%` }} /></div></div>
}

function Info({ label, value, detail }: { label: string; value: string; detail?: string | null }) {
  return <div className="rounded-xl border border-glass-border bg-white/[0.025] p-3"><p className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em] text-muted">{label}</p><p className="line-clamp-2 text-xs font-semibold text-primary">{value}</p>{detail && <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted">{detail}</p>}</div>
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
