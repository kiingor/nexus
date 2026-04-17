'use client'

import { Trash2, Phone, Hash, Calendar } from 'lucide-react'
import { parseQuestionario, toNumber } from '@/lib/monitoria'
import type { MonitoriaRecord } from '@/lib/types'

interface Props {
  records: MonitoriaRecord[]
  onSelect: (record: MonitoriaRecord) => void
  onDelete: (id: string) => void
}

function notaColor(nota: number | null): string {
  if (nota == null) return 'text-muted'
  if (nota >= 8) return 'text-green-400'
  if (nota >= 6) return 'text-yellow-400'
  return 'text-red-400'
}

function notaBg(nota: number | null): string {
  if (nota == null) return 'bg-glass border-glass-border'
  if (nota >= 8) return 'bg-green-500/10 border-green-500/25'
  if (nota >= 6) return 'bg-yellow-500/10 border-yellow-500/25'
  return 'bg-red-500/10 border-red-500/25'
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

export function MonitoriaList({ records, onSelect, onDelete }: Props) {
  return (
    <div className="glass overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-glass-border text-left text-xs uppercase tracking-wider text-muted">
            <th className="px-4 py-3 font-medium">Data</th>
            <th className="px-4 py-3 font-medium">Nota IA</th>
            <th className="px-4 py-3 font-medium">Nota Cliente</th>
            <th className="px-4 py-3 font-medium">Ramal</th>
            <th className="px-4 py-3 font-medium">Contato</th>
            <th className="px-4 py-3 font-medium">Resumo</th>
            <th className="px-4 py-3 font-medium w-10"></th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const notaIA = toNumber(r.nota_avaliacao)
            const notaCli = toNumber(r.nota_cliente)
            const parsed = parseQuestionario(r.questionario)

            return (
              <tr
                key={r.id}
                onClick={() => onSelect(r)}
                className="border-b border-glass-border/50 hover:bg-white/[0.02] cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-sm text-secondary">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-muted" />
                    {formatDate(r.data_avaliacao || r.created_at)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${notaBg(
                      notaIA
                    )} ${notaColor(notaIA)}`}
                  >
                    {notaIA != null ? notaIA.toFixed(1) : '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-semibold ${notaColor(notaCli)}`}>
                    {notaCli != null ? notaCli.toFixed(1) : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-secondary">
                  {r.ramal ? (
                    <div className="flex items-center gap-1.5">
                      <Hash size={12} className="text-muted" />
                      {r.ramal}
                    </div>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-secondary">
                  {r.numero_contato ? (
                    <div className="flex items-center gap-1.5">
                      <Phone size={12} className="text-muted" />
                      {r.numero_contato}
                    </div>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-secondary max-w-md">
                  <p className="line-clamp-1">
                    {parsed.resumo || <span className="text-muted">Sem resumo</span>}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('Excluir esta avaliação?')) onDelete(r.id)
                    }}
                    className="text-muted hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10 cursor-pointer"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
