'use client'

import { GlassModal } from '@/components/ui/GlassModal'
import { Star } from 'lucide-react'
import { parseQuestionario, statusColor, toNumber } from '@/lib/monitoria'
import type { MonitoriaRecord } from '@/lib/types'

interface Props {
  record: MonitoriaRecord | null
  open: boolean
  onClose: () => void
}

function notaColor(nota: number | null): string {
  if (nota == null) return 'text-muted'
  if (nota >= 8) return 'text-green-400'
  if (nota >= 6) return 'text-yellow-400'
  return 'text-red-400'
}

export function MonitoriaDetailModal({ record, open, onClose }: Props) {
  if (!record) return null

  const notaIA = toNumber(record.nota_avaliacao)
  const notaCli = toNumber(record.nota_cliente)
  const parsed = parseQuestionario(record.questionario)

  return (
    <GlassModal open={open} onClose={onClose} title="Detalhes da Avaliação" className="max-w-3xl">
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
        {/* Notas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass p-3">
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted mb-1.5">
              <Star size={12} /> Nota IA
            </div>
            <p className={`text-3xl font-bold ${notaColor(notaIA)}`}>
              {notaIA != null ? notaIA.toFixed(1) : '—'}
              <span className="text-sm text-muted font-normal"> / 10</span>
            </p>
          </div>
          <div className="glass p-3">
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted mb-1.5">
              <Star size={12} /> Nota Cliente
            </div>
            <p className={`text-3xl font-bold ${notaColor(notaCli)}`}>
              {notaCli != null ? notaCli.toFixed(1) : '—'}
              <span className="text-sm text-muted font-normal"> / 10</span>
            </p>
          </div>
        </div>

        {/* Metadados */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Meta label="Ramal" value={record.ramal} />
          <Meta label="Contato" value={record.numero_contato} />
          <Meta
            label="Data"
            value={
              record.data_avaliacao
                ? new Date(record.data_avaliacao).toLocaleString('pt-BR')
                : null
            }
          />
        </div>

        {/* Resumo */}
        {parsed.resumo && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted mb-2">Resumo</h3>
            <p className="text-sm text-primary leading-relaxed">{parsed.resumo}</p>
          </div>
        )}

        {/* Critérios do questionário */}
        {parsed.items.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted mb-2">
              Questionário ({parsed.items.length} critérios)
            </h3>
            <div className="space-y-2">
              {parsed.items.map((item, i) => (
                <div key={i} className="glass p-3">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <p className="text-sm font-medium text-primary flex-1">{item.criterio}</p>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${statusColor(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  {item.justificativa && (
                    <p className="text-xs text-secondary leading-relaxed">{item.justificativa}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transcrição */}
        {record.transcricao && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted mb-2">Transcrição</h3>
            <pre className="glass p-3 text-xs text-secondary whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
              {record.transcricao}
            </pre>
          </div>
        )}
      </div>
    </GlassModal>
  )
}

function Meta({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">{label}</p>
      <p className="text-sm text-primary">{value || <span className="text-muted">—</span>}</p>
    </div>
  )
}
