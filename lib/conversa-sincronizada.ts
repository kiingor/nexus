import {
  REMETENTES_NEXUS,
  type Mensagem,
  type MensagemTipo,
  type RemetenteNexus,
} from '@/lib/supabase/mensagens'

type JsonObject = Record<string, unknown>

const TIPOS = new Set<MensagemTipo>([
  'texto',
  'imagem',
  'audio',
  'video',
  'documento',
])

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []

  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Converte `atendimentos.conversa_json` para o formato que a tela ja
 * recebia de `public.mensagens`.
 */
export function parseConversaSincronizada(value: unknown): Mensagem[] {
  return parseArray(value)
    .flatMap((item): Mensagem[] => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return []
      const row = item as JsonObject
      const remetente = nullableString(row.remetente)
      const id = nullableString(row.source_message_id) ?? nullableString(row.id)

      if (
        !id ||
        !remetente ||
        !REMETENTES_NEXUS.includes(remetente as RemetenteNexus)
      ) {
        return []
      }

      const tipo = nullableString(row.tipo)
      return [{
        id,
        ticket_id: nullableString(row.ticket_id),
        cliente_id: nullableString(row.cliente_id),
        remetente: remetente as RemetenteNexus,
        conteudo: nullableString(row.conteudo),
        tipo: tipo && TIPOS.has(tipo as MensagemTipo)
          ? tipo as MensagemTipo
          : 'texto',
        enviado_em: nullableString(row.enviado_em),
        is_bot: typeof row.is_bot === 'boolean'
          ? row.is_bot
          : remetente === 'bot-nexus',
        url_imagem: nullableString(row.url_imagem),
        media_type: nullableString(row.media_type),
        canal: nullableString(row.canal),
        reply_to_message_id: nullableString(row.reply_to_message_id),
      }]
    })
    .sort((a, b) => {
      const timeA = Date.parse(a.enviado_em ?? '')
      const timeB = Date.parse(b.enviado_em ?? '')
      if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
        return timeA - timeB
      }
      return a.id.localeCompare(b.id)
    })
}
