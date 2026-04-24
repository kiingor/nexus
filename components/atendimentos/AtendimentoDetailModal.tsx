'use client'

import { GlassModal } from '@/components/ui/GlassModal'
import { Spinner } from '@/components/ui/Spinner'
import { Building2, Phone, MessageSquare, Star, Monitor, Calendar, DollarSign, Smile } from 'lucide-react'
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
          <Meta label="ID Ligação" value={detail.id_ligacao} />
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
        {(detail.transcricao_formatada || detail.transcricao) && (
          <Section title="Transcrição">
            <pre className="text-xs text-secondary bg-glass border border-glass-border rounded-xl p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[320px]">
              {detail.transcricao_formatada || detail.transcricao}
            </pre>
          </Section>
        )}

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
