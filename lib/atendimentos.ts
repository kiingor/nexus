// Helpers compartilhados para a aba de Atendimentos

// duracao_segundos vem do banco em MILISSEGUNDOS (apesar do nome).
// Converte pra segundos pra exibição e cálculos.
export function duracaoToSegundos(v: number | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  return Math.round(n / 1000)
}

export function formatDuracao(v: number | null | undefined): string {
  const totalSec = duracaoToSegundos(v)
  if (totalSec == null) return '—'
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}m${String(s).padStart(2, '0')}s`
}

export function toNumber(v: number | string | null | undefined): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function formatCusto(v: number | string | null | undefined): string {
  const n = toNumber(v)
  if (n == null) return '—'
  try {
    return n.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  } catch {
    return `$${n.toFixed(2)}`
  }
}

// Classifica o sentimento para cores no UI. Tolera variações de texto (pt/en).
export function sentimentoBadge(
  sentimento: string | null | undefined
): { label: string; cls: string } | null {
  if (!sentimento) return null
  const s = String(sentimento).trim().toLowerCase()
  if (!s) return null

  const positive = ['positivo', 'positive', 'satisfeito', 'feliz', 'bom', 'ótimo', 'otimo', 'excelente']
  const negative = ['negativo', 'negative', 'insatisfeito', 'irritado', 'frustrado', 'ruim', 'péssimo', 'pessimo', 'raiva']
  const neutral = ['neutro', 'neutral', 'ok', 'indiferente']

  if (positive.some((k) => s.includes(k)))
    return { label: sentimento, cls: 'bg-green-500/10 border-green-500/25 text-green-400' }
  if (negative.some((k) => s.includes(k)))
    return { label: sentimento, cls: 'bg-red-500/10 border-red-500/25 text-red-400' }
  if (neutral.some((k) => s.includes(k)))
    return { label: sentimento, cls: 'bg-glass border-glass-border text-secondary' }

  return { label: sentimento, cls: 'bg-glass border-glass-border text-secondary' }
}
