import type { AtendimentoRecord } from '@/lib/types'
import { formatTipoAtendimento } from '@/lib/tipos-atendimento'

const STATUS_LABEL: Record<string, string> = {
  em_atendimento: 'Em atendimento',
  transferida: 'Transferida',
  resolvida_ia: 'Resolvida IA',
  resolvido_parcialmente: 'Resolvido Parcialmente',
  interrompida: 'Interrompida',
}

const DESTINO_LABEL: Record<string, string> = {
  servicedesk: 'ServiceDesk',
  financeiro: 'Financeiro',
  comercial: 'Comercial',
  ouvidoria: 'Ouvidoria',
}

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function linha(label: string, valor: unknown): string | null {
  if (valor == null || valor === '') return null
  return `- **${label}:** ${valor}`
}

// Registro + a conversa real já montada (do banco de mensagens). Quando
// `conversa` está presente, é ela que vai no bloco — não a `transcricao`
// gravada pelo n8n, que agrupa mensagens consecutivas e pode divergir.
export type AtendimentoExport = AtendimentoRecord & { conversa?: string | null }

// Um atendimento como bloco Markdown. Inclui os campos principais, o
// problema/solução e a conversa (real, se fornecida; senão a transcrição).
export function atendimentoToMarkdown(a: AtendimentoExport): string {
  const titulo = a.nome_empresa || a.cliente_nome || `Atendimento #${a.id}`
  const campos = [
    linha('ID', a.id),
    linha('Data', fmtData(a.data_hora_chegada || a.criado_em)),
    linha('Status', STATUS_LABEL[a.status ?? ''] ?? a.status),
    linha('Destino', DESTINO_LABEL[a.destino ?? ''] ?? a.destino),
    linha('Tipo de atendimento', a.tipo_atendimento ? formatTipoAtendimento(a.tipo_atendimento) : null),
    linha('Tipo de contato', a.tipo_contato === 'ligacao' ? 'Ligação' : a.tipo_contato === 'chat' ? 'Chat' : null),
    linha('Cliente', a.cliente_nome),
    linha('CNPJ', a.cnpj),
    linha('Telefone', a.phone),
    linha('PDV', a.pdv),
    linha('Sentimento', a.sentimento_cliente),
    linha('Nota', a.nota),
  ].filter(Boolean)

  const partes = [`## ${titulo}`, '', campos.join('\n')]

  if (a.problema_relatado) {
    partes.push('', `**Problema relatado:**`, '', a.problema_relatado)
  }
  if (a.solucao_aplicada) {
    partes.push('', `**Solução aplicada:**`, '', a.solucao_aplicada)
  }
  // Conversa real (banco de mensagens) tem prioridade sobre a transcrição.
  const conversa = a.conversa?.trim() || a.transcricao?.trim()
  if (conversa) {
    partes.push('', `**Conversa:**`, '', '```', conversa, '```')
  }
  return partes.join('\n')
}

// Vários atendimentos num único documento, com um cabeçalho de contexto.
export function atendimentosToMarkdown(
  registros: AtendimentoExport[],
  contexto?: string
): string {
  const cab = [
    `# Atendimentos`,
    '',
    contexto ? `**${contexto}**` : null,
    `_${registros.length} atendimento(s) · gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}_`,
  ]
    .filter(Boolean)
    .join('\n')

  return [cab, '', registros.map(atendimentoToMarkdown).join('\n\n---\n\n')].join('\n')
}
