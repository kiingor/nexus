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

export type TranscricaoMessage = {
  speaker: string
  isClient: boolean
  text: string
}

// Parseia transcrições no formato "Speaker: texto\nSpeaker: texto" em uma
// lista de mensagens. Qualquer speaker diferente de "Cliente" é tratado
// como atendente, então a função fica imune a troca de nome do agente
// (Beto, Claudio, etc.) sem mudança de código. Linhas sem prefixo
// "Speaker:" são tratadas como continuação da mensagem anterior — útil
// quando o atendente manda um passo a passo com várias linhas.
export function parseTranscricao(
  raw: string | null | undefined
): TranscricaoMessage[] {
  if (!raw) return []
  const lines = String(raw).split(/\r?\n/)
  const out: TranscricaoMessage[] = []
  let current: TranscricaoMessage | null = null

  // Speaker = uma palavra (sem espaço) com letras possivelmente acentuadas.
  // Restringir a uma palavra evita falsos positivos quando o cliente
  // escreve algo como "lendo agora: ...".
  const re = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.'-]*):\s?(.*)$/

  for (const line of lines) {
    const m = re.exec(line)
    if (m) {
      if (current) out.push(current)
      const speaker = m[1].trim()
      current = {
        speaker,
        isClient: speaker.toLowerCase() === 'cliente',
        text: m[2] ?? '',
      }
    } else if (current) {
      current.text += (current.text ? '\n' : '') + line
    } else if (line.trim()) {
      current = { speaker: '', isClient: false, text: line }
    }
  }
  if (current) out.push(current)
  return out
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
