'use client'

import { Building2, Calendar, Layers, MessageCircle, Monitor, Phone, PhoneCall, Star } from 'lucide-react'
import type { AtendimentoRecord } from '@/lib/types'

// `mergedCount`/`mergedIds` são opcionais — vêm do agrupamento client-side
// feito na página. Quando ausentes, o componente se comporta como antes.
export type AtendimentoListRecord = AtendimentoRecord & {
  mergedCount?: number
  mergedIds?: number[]
}

interface Props {
  records: AtendimentoListRecord[]
  onSelect: (record: AtendimentoListRecord) => void
}

// Janela em milissegundos para considerar um atendimento "novo" — usada
// pelo selo de estrela na coluna Data. Avaliada no render, então clicar
// em "Atualizar" reavalia todas as linhas com base no momento atual.
const NOVO_WINDOW_MS = 5 * 60 * 1000

function isNovo(iso: string | null): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  return Date.now() - t < NOVO_WINDOW_MS
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function statusBadge(status: string | null): { label: string; cls: string } {
  switch (status) {
    case 'em_atendimento':
      return { label: 'Em atendimento', cls: 'bg-blue-500/10 border-blue-500/25 text-blue-400' }
    case 'transferida':
      return { label: 'Transferida', cls: 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400' }
    case 'resolvida_ia':
      return { label: 'Resolvida IA', cls: 'bg-green-500/10 border-green-500/25 text-green-400' }
    case 'interrompida':
      return { label: 'Interrompida', cls: 'bg-red-500/10 border-red-500/25 text-red-400' }
    default:
      return { label: status ?? '—', cls: 'bg-glass border-glass-border text-muted' }
  }
}

function destinoBadge(destino: string | null): { label: string; cls: string } | null {
  if (!destino) return null
  if (destino === 'servicedesk')
    return { label: 'ServiceDesk', cls: 'bg-blue-500/10 border-blue-500/25 text-blue-400' }
  if (destino === 'financeiro')
    return { label: 'Financeiro', cls: 'bg-purple-500/10 border-purple-500/25 text-purple-400' }
  return { label: destino, cls: 'bg-glass border-glass-border text-muted' }
}

// Badge de tipo de contato. Lê a string da coluna tipo_contato em atendimentos.
function tipoContatoBadge(
  tipo: string | null
): { label: string; cls: string; icon: 'phone' | 'message' } | null {
  if (!tipo) return null
  if (tipo === 'ligacao') {
    return {
      label: 'Ligação',
      cls: 'bg-blue-500/10 border-blue-500/25 text-blue-400',
      icon: 'phone',
    }
  }
  if (tipo === 'chat') {
    return {
      label: 'Chat',
      cls: 'bg-green-500/10 border-green-500/25 text-green-400',
      icon: 'message',
    }
  }
  // Fallback pra qualquer valor inesperado — mostra cru com badge neutro
  return {
    label: tipo,
    cls: 'bg-glass border-glass-border text-muted',
    icon: 'message',
  }
}

// Renderiza a nota como 5 estrelas, preenchendo as primeiras `nota`.
// Cor adapta ao valor: 1-2 vermelho, 3 amarelo, 4-5 verde.
function NotaCell({ nota }: { nota: number | null | undefined }) {
  if (nota == null || Number.isNaN(nota)) {
    return <span className="text-xs text-muted">—</span>
  }
  const clamped = Math.max(1, Math.min(5, Math.round(nota)))
  const color =
    clamped >= 4 ? 'text-green-400' : clamped === 3 ? 'text-yellow-400' : 'text-red-400'
  return (
    <div
      className="inline-flex items-center gap-0.5"
      title={`Nota: ${clamped}/5`}
      aria-label={`Nota ${clamped} de 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={12}
          className={i < clamped ? `${color} fill-current` : 'text-muted/30'}
        />
      ))}
    </div>
  )
}

export function AtendimentosList({ records, onSelect }: Props) {
  return (
    <div className="glass overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-glass-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Destino</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Telefone</th>
              <th className="px-4 py-3 font-medium">Nota</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const st = statusBadge(r.status)
              const dest = destinoBadge(r.destino)
              const tipo = tipoContatoBadge(r.tipo_contato ?? null)
              const novo = isNovo(r.data_hora_chegada || r.criado_em)

              return (
                <tr
                  key={r.id}
                  onClick={() => onSelect(r)}
                  className="border-b border-glass-border/50 hover:bg-white/[0.02] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-secondary">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-muted" />
                      {formatDate(r.data_hora_chegada || r.criado_em)}
                      {novo && (
                        <span title="Novo" aria-label="Novo" className="inline-flex">
                          <Star
                            size={14}
                            className="text-yellow-400 fill-yellow-400 ml-1 animate-pulse"
                          />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {tipo ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${tipo.cls}`}
                      >
                        {tipo.icon === 'phone' ? <PhoneCall size={11} /> : <MessageCircle size={11} />}
                        {tipo.label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${st.cls}`}
                    >
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {dest ? (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${dest.cls}`}
                      >
                        {dest.label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-primary">
                    <div className="flex items-center gap-1.5 max-w-[320px]">
                      <Building2 size={12} className="text-muted shrink-0" />
                      <span className="truncate">{r.nome_empresa || '—'}</span>
                      {r.pdv && r.pdv.trim() && (
                        <span
                          title={`PDV: ${r.pdv}`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border bg-cyan-500/10 border-cyan-500/30 text-cyan-300 shrink-0 whitespace-nowrap max-w-[140px] truncate"
                        >
                          <Monitor size={10} className="shrink-0" />
                          <span className="truncate">{r.pdv}</span>
                        </span>
                      )}
                      {typeof r.mergedCount === 'number' && r.mergedCount > 1 && (
                        <span
                          title={`${r.mergedCount} atendimentos unidos · IDs: ${(r.mergedIds ?? []).join(', ')}`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border bg-orange-500/10 border-orange-500/30 text-orange-300 shrink-0 whitespace-nowrap"
                        >
                          <Layers size={10} />
                          +{r.mergedCount - 1} unidos
                        </span>
                      )}
                    </div>
                    {r.cnpj && (
                      <div className="text-[11px] text-muted mt-0.5">{r.cnpj}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-secondary">
                    <div className="flex items-center gap-1.5">
                      <Phone size={12} className="text-muted" />
                      {r.phone || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <NotaCell nota={r.nota} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
