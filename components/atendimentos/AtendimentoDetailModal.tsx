'use client'

import { useState } from 'react'
import { GlassModal } from '@/components/ui/GlassModal'
import { Spinner } from '@/components/ui/Spinner'
import { Building2, Phone, MessageSquare, Star, Monitor, Calendar, DollarSign, Smile, Copy, Check } from 'lucide-react'
import type { AtendimentoRecord, AvaliacaoAtendimentoRecord } from '@/lib/types'
import { formatCusto, sentimentoBadge } from '@/lib/atendimentos'

interface Props {
  record: AtendimentoRecord | null
  open: boolean
  onClose: () => void
  avaliacoes: AvaliacaoAtendimentoRecord[]
  loadingAvaliacoes: boolean
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR')
  } catch {
    return iso
  }
}

function duration(sec: number | null) {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}m${String(s).padStart(2, '0')}s`
}

export function AtendimentoDetailModal({
  record,
  open,
  onClose,
  avaliacoes,
  loadingAvaliacoes,
}: Props) {
  if (!record) return null

  const detail = record
  const problema = detail.problema_extraido
  const temProblema = problema?.tem_problema_extraivel === true

  return (
    <GlassModal open={open} onClose={onClose} title="Detalhes do Atendimento" className="max-w-4xl">
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
        {/* Header */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Meta icon={<Calendar size={12} />} label="Início" value={fmt(detail.data_hora_chegada)} />
          <Meta icon={<Calendar size={12} />} label="Fim" value={fmt(detail.data_hora_saida)} />
          <Meta label="Duração" value={duration(detail.duracao_segundos)} />
          <Meta icon={<DollarSign size={12} />} label="Custo" value={formatCusto(detail.custo_real)} />
        </div>

        {/* Sentimento + ID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="glass p-3">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted mb-1">
              <Smile size={12} />
              Sentimento do cliente
            </div>
            {(() => {
              const b = sentimentoBadge(detail.sentimento_cliente)
              return b ? (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${b.cls}`}
                >
                  {b.label}
                </span>
              ) : (
                <p className="text-sm text-muted">—</p>
              )
            })()}
          </div>
          <IdLigacaoMeta value={detail.id_ligacao} />
        </div>

        {/* Cliente */}
        <Section title="Cliente">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <Meta icon={<Building2 size={12} />} label="Empresa" value={detail.nome_empresa} />
            <Meta label="CNPJ" value={detail.cnpj} />
            <Meta label="Cliente" value={detail.cliente_nome} />
            <Meta icon={<Phone size={12} />} label="Telefone" value={detail.phone} />
            <Meta icon={<MessageSquare size={12} />} label="WhatsApp" value={detail.whatsapp_contato} />
            <Meta icon={<Monitor size={12} />} label="AnyDesk" value={detail.numero_anydesk} />
          </div>
        </Section>

        {/* Problema */}
        <Section title="Problema">
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-xs uppercase tracking-wider text-muted">Relatado pela IA</span>
              <p className="text-primary mt-1">{detail.problema_relatado || '—'}</p>
            </div>
            {detail.solucao_aplicada && (
              <div>
                <span className="text-xs uppercase tracking-wider text-muted">Solução aplicada</span>
                <p className="text-primary mt-1">{detail.solucao_aplicada}</p>
              </div>
            )}
          </div>
        </Section>

        {/* Problema extraído */}
        {problema && (
          <Section title="Análise Estruturada">
            {temProblema && problema.problema ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <Meta label="Categoria" value={problema.problema.categoria} />
                <Meta label="Módulo" value={problema.problema.modulo_afetado} />
                <Meta label="Frequência" value={problema.problema.frequencia} />
                <Meta label="Confiança" value={problema.confianca as string | null} />
                {problema.problema.descricao_tecnica && (
                  <div className="md:col-span-2">
                    <span className="text-xs uppercase tracking-wider text-muted">Descrição técnica</span>
                    <p className="text-primary mt-1">{problema.problema.descricao_tecnica}</p>
                  </div>
                )}
                {problema.problema.mensagem_erro && (
                  <div className="md:col-span-2">
                    <span className="text-xs uppercase tracking-wider text-muted">Mensagem de erro</span>
                    <p className="text-primary mt-1">{problema.problema.mensagem_erro}</p>
                  </div>
                )}
                {problema.problema.impacto_relatado && (
                  <div className="md:col-span-2">
                    <span className="text-xs uppercase tracking-wider text-muted">Impacto</span>
                    <p className="text-primary mt-1">{problema.problema.impacto_relatado}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">
                Sem problema extraível
                {problema.motivo_descarte ? ` — ${problema.motivo_descarte}` : ''}
              </p>
            )}
          </Section>
        )}

        {/* Transcrição */}
        <TranscricaoBlock
          formatada={detail.transcricao_formatada}
          original={detail.transcricao}
        />

        {/* Avaliações */}
        <Section title="Avaliações do Cliente">
          {loadingAvaliacoes ? (
            <div className="py-4 flex justify-center">
              <Spinner size="sm" />
            </div>
          ) : avaliacoes.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma avaliação registrada.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {avaliacoes.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-glass border border-glass-border"
                >
                  <Star size={14} className="text-yellow-400" />
                  <span className="text-sm font-semibold text-primary">{a.nota ?? '—'}/5</span>
                  <span className="text-xs text-muted">{fmt(a.criado_em)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </GlassModal>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-muted mb-2">{title}</h3>
      {children}
    </div>
  )
}

function TranscricaoBlock({
  formatada,
  original,
}: {
  formatada: string | null
  original: string | null
}) {
  const hasFormatada = !!formatada && formatada.trim() !== ''
  const hasOriginal = !!original && original.trim() !== ''

  const [view, setView] = useState<'formatada' | 'original'>(
    hasFormatada ? 'formatada' : 'original'
  )
  const [copied, setCopied] = useState(false)

  if (!hasFormatada && !hasOriginal) {
    return (
      <Section title="Transcrição">
        <p className="text-sm text-muted">Transcrição indisponível.</p>
      </Section>
    )
  }

  const showing = view === 'formatada' && hasFormatada ? formatada : original
  const text = String(showing ?? '')

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <Section title="Transcrição">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        {hasFormatada && hasOriginal ? (
          <div className="inline-flex rounded-xl border border-glass-border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setView('formatada')}
              className={`px-3 py-1.5 cursor-pointer transition-colors ${
                view === 'formatada'
                  ? 'bg-orange-500/10 text-orange-400'
                  : 'text-muted hover:text-primary hover:bg-white/5'
              }`}
            >
              Formatada
            </button>
            <button
              type="button"
              onClick={() => setView('original')}
              className={`px-3 py-1.5 cursor-pointer transition-colors border-l border-glass-border ${
                view === 'original'
                  ? 'bg-orange-500/10 text-orange-400'
                  : 'text-muted hover:text-primary hover:bg-white/5'
              }`}
            >
              Original (Supabase)
            </button>
          </div>
        ) : (
          <span className="text-[11px] uppercase tracking-wider text-muted">
            {hasFormatada ? 'Formatada' : 'Original (Supabase)'}
          </span>
        )}

        <button
          type="button"
          onClick={copyAll}
          title={copied ? 'Copiado!' : 'Copiar transcrição'}
          aria-label="Copiar transcrição"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs transition-colors cursor-pointer ${
            copied
              ? 'bg-green-500/10 border-green-500/25 text-green-400'
              : 'bg-glass border-glass-border text-muted hover:text-primary hover:border-orange-500/40'
          }`}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>

      <pre className="text-xs text-secondary bg-glass border border-glass-border rounded-xl p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[320px]">
        {text}
      </pre>
    </Section>
  )
}

function Meta({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number | null | undefined
  icon?: React.ReactNode
}) {
  return (
    <div className="glass p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted mb-1">
        {icon}
        {label}
      </div>
      <p className="text-sm text-primary truncate">
        {value != null && value !== '' ? String(value) : '—'}
      </p>
    </div>
  )
}

function IdLigacaoMeta({ value }: { value: string | null | undefined }) {
  const [copied, setCopied] = useState(false)
  const has = value != null && value !== ''

  async function handleCopy() {
    if (!has) return
    try {
      await navigator.clipboard.writeText(String(value))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard may be blocked — ignore silently
    }
  }

  return (
    <div className="glass p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted mb-1">
        ID Ligação
      </div>
      <div className="flex items-center gap-2">
        <p className="text-sm text-primary truncate flex-1 font-mono" title={has ? String(value) : undefined}>
          {has ? String(value) : '—'}
        </p>
        {has && (
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? 'Copiado!' : 'Copiar ID'}
            aria-label="Copiar ID da ligação"
            className={`shrink-0 p-1.5 rounded-lg border transition-colors cursor-pointer ${
              copied
                ? 'bg-green-500/10 border-green-500/25 text-green-400'
                : 'bg-glass border-glass-border text-muted hover:text-primary hover:border-orange-500/40'
            }`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        )}
      </div>
    </div>
  )
}
