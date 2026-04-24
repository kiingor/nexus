'use client'

import { Building2, Calendar, Clock, Phone } from 'lucide-react'
import type { AtendimentoRecord } from '@/lib/types'

interface Props {
  records: AtendimentoRecord[]
  onSelect: (record: AtendimentoRecord) => void
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

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m${String(s).padStart(2, '0')}s`
}

function statusBadge(status: string | null): { label: string; cls: string } {
  switch (status) {
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

export function AtendimentosList({ records, onSelect }: Props) {
  return (
    <div className="glass overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-glass-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Destino</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Telefone</th>
              <th className="px-4 py-3 font-medium">Duração</th>
              <th className="px-4 py-3 font-medium">Problema</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const st = statusBadge(r.status)
              const dest = destinoBadge(r.destino)
              const problema =
                r.problema_extraido?.problema?.descricao_tecnica ||
                r.problema_relatado ||
                '—'

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
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${st.cls}`}
                    >
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {dest ? (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${dest.cls}`}
                      >
                        {dest.label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-primary">
                    <div className="flex items-center gap-1.5 max-w-[200px] truncate">
                      <Building2 size={12} className="text-muted shrink-0" />
                      <span className="truncate">{r.nome_empresa || '—'}</span>
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
                  <td className="px-4 py-3 text-sm text-secondary">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-muted" />
                      {formatDuration(r.duracao_segundos)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-secondary max-w-[320px]">
                    <p className="truncate" title={problema}>
                      {problema}
                    </p>
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
