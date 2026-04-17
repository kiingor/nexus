import type { Questionario, QuestionarioParsed, QuestionarioItem } from './types'

export function toNumber(val: number | string | null | undefined): number | null {
  if (val == null || val === '') return null
  const n = typeof val === 'number' ? val : Number(val)
  return Number.isFinite(n) ? n : null
}

export function parseQuestionario(q: Questionario): QuestionarioParsed {
  if (!q) return { resumo: '', items: [] }

  // Legacy structured format (from old /avaliar endpoint)
  if (typeof q === 'object' && 'criterios' in q) {
    const items: QuestionarioItem[] = q.criterios.map((c) => ({
      criterio: c.criterio,
      status: c.nota >= 7 ? 'Sim' : c.nota < 4 ? 'Não' : 'NA',
      justificativa: c.justificativa,
    }))
    return { resumo: q.resumo, items }
  }

  // String format from n8n: "Resumo: ... | Criterio: Sim - Justificativa | ..."
  if (typeof q === 'string') {
    const items: QuestionarioItem[] = []
    let resumo = ''

    for (const chunk of q.split('|').map((p) => p.trim()).filter(Boolean)) {
      const colonIdx = chunk.indexOf(':')
      if (colonIdx === -1) continue

      const label = chunk.slice(0, colonIdx).trim()
      const rest = chunk.slice(colonIdx + 1).trim()

      if (label.toLowerCase() === 'resumo') {
        resumo = rest
        continue
      }

      const dashIdx = rest.indexOf(' - ')
      if (dashIdx === -1) {
        items.push({ criterio: label, status: rest, justificativa: '' })
      } else {
        items.push({
          criterio: label,
          status: rest.slice(0, dashIdx).trim(),
          justificativa: rest.slice(dashIdx + 3).trim(),
        })
      }
    }

    return { resumo, items }
  }

  return { resumo: '', items: [] }
}

export function statusColor(status: string): string {
  const s = status.toLowerCase()
  if (s === 'sim') return 'text-green-400 bg-green-500/10 border-green-500/25'
  if (s === 'não' || s === 'nao' || s === 'no') return 'text-red-400 bg-red-500/10 border-red-500/25'
  if (s === 'na' || s === 'n/a') return 'text-muted bg-glass border-glass-border'
  return 'text-secondary bg-glass border-glass-border'
}
