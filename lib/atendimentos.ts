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

// Lista canônica e específica de motivos de contato. Usada pelo dashboard
// pra agrupar atendimentos em buckets analisáveis.
//
// A ordem aqui NÃO importa pra runtime, mas a ORDEM dos checks no
// `classifyMotivo` SIM — vai do mais específico ao mais geral.
export const MOTIVO_CATEGORIES = [
  // NF-e / SAT / Fiscal
  'NF-e Rejeitada',
  'Erro Emissão NF-e',
  'Cancelamento NF-e',
  'NFC-e',
  'SAT / CF-e',
  'Carta de Correção',
  'Certificado Digital',
  'SPED Fiscal',
  'Configuração Fiscal',
  // Financeiro / Pagamento
  'Erro 337 (Boleto)',
  'Boleto / Mensalidade',
  'Liberação Pós-Pagamento',
  'PIX',
  'Renegociação',
  // Sistema
  'Sistema Não Abre',
  'Travamento / Crash',
  'Lentidão',
  // Hardware / Periféricos
  'Impressora',
  'Pin Pad / Leitor',
  'Balança / Etiqueta',
  // Cadastros / Configuração
  'Cadastro Cliente/Produto',
  'CNAB / Remessa',
  'Convênio Bancário',
  // Acesso
  'Senha / Login',
  'Bloqueio de Usuário',
  // Caixa / Vendas
  'Caixa / Fechamento',
  'Cancelamento Venda',
  'TEF',
  // Estoque
  'Estoque / Inventário',
  // Integrações
  'Integração / API',
  // Operacional
  'Relatório',
  'Atualização / Versão',
  'Instalação',
  'Servidor / Rede',
  'Treinamento',
  'Suporte geral',
] as const

export type MotivoCategoria = (typeof MOTIVO_CATEGORIES)[number]

// Classifica um atendimento numa das categorias específicas a partir de
// problema_relatado + transcricao.
//
// Híbrido: se houver `problema_extraido.problema.categoria` (extração
// estruturada upstream) e ela bater com uma categoria canônica, prevalece.
// Senão, aplica regex.
//
// IMPORTANTE: a ordem dos checks abaixo é crítica. Casos específicos
// (erro 337, certificado digital) devem vir ANTES dos genéricos (boleto,
// emissão de NF-e), senão são engolidos por eles.
export function classifyMotivo(input: {
  problema_relatado?: string | null
  transcricao?: string | null
  problema_extraido?: {
    problema?: { categoria?: string | null } | null
  } | null
}): MotivoCategoria {
  // 1. Categoria estruturada (vinda do problema_extraido)
  const cat = input.problema_extraido?.problema?.categoria?.trim()
  if (cat) {
    const match = MOTIVO_CATEGORIES.find(
      (m) => m.toLowerCase() === cat.toLowerCase()
    )
    if (match) return match
  }

  // 2. Regex sobre problema_relatado + transcricao
  const t = ((input.problema_relatado ?? '') + ' ' + (input.transcricao ?? '')).toLowerCase()

  // ── Casos MUITO específicos primeiro ──────────────────────────────
  if (/\berro\s*337\b|rejeição\s*337|\b337\b/.test(t)) return 'Erro 337 (Boleto)'
  if (/carta de correção|\bcc-?e\b/.test(t)) return 'Carta de Correção'
  if (/certificado digital|certificado.*a[13]|\ba1\b|\ba3\b|expir.*certificado/.test(t)) return 'Certificado Digital'

  // ── NF-e / SAT / Fiscal ───────────────────────────────────────────
  if (/nfc-?e|nfce/.test(t)) return 'NFC-e'
  if (/\bsat\b|cf-?e|cfe/.test(t)) return 'SAT / CF-e'
  if (/nota fiscal rejeitada|rejeição|nf.*rejeitada|nfe rejeitada/.test(t)) return 'NF-e Rejeitada'
  if (/cancelamento de nota|cancelar nf|cancelamento.*nf/.test(t)) return 'Cancelamento NF-e'
  if (/erro na emissão|série da nota|emit.*nf|emissão.*nf|emitir nf/.test(t)) return 'Erro Emissão NF-e'
  if (/sped|e-sped|escrituração/.test(t)) return 'SPED Fiscal'
  if (/configuração fiscal|tributação|\bcfop\b|\bncm\b|\bcest\b|aliquota|alíquota/.test(t)) return 'Configuração Fiscal'

  // ── Financeiro / Pagamento ────────────────────────────────────────
  if (/liberação|desbloqueio|bloqueado|liberar acesso|pago.*libera|libera.*pago/.test(t)) return 'Liberação Pós-Pagamento'
  if (/\bpix\b/.test(t)) return 'PIX'
  if (/renegociação|acordo|parcelar.*divida|negociação.*divida|negociação.*débito/.test(t)) return 'Renegociação'
  if (/boleto vencido|segunda via|2ª via|2a via|boleto.*mensalidade|mensalidade|meu boleto|minha fatura|fatura.*softcom/.test(t)) return 'Boleto / Mensalidade'
  if (/boleto|fatura|cobrança|pagamento|vencimento/.test(t)) return 'Boleto / Mensalidade'

  // ── Sistema ───────────────────────────────────────────────────────
  if (/não abre|nao abre|não inicia|nao inicia|não carrega|nao carrega|erro ao abrir/.test(t)) return 'Sistema Não Abre'
  if (/travou|travando|crash|congel|fecha sozinho|fechou sozinho/.test(t)) return 'Travamento / Crash'
  if (/lentidão|lento|demora|banco de dados/.test(t)) return 'Lentidão'

  // ── Hardware / Periféricos ────────────────────────────────────────
  if (/pin\s*pad|pinpad|leitor.*cartão|leitor de cartao/.test(t)) return 'Pin Pad / Leitor'
  if (/etiqueta|balança|balanca|leitor.*código de barras|leitor de codigo/.test(t)) return 'Balança / Etiqueta'
  if (/impressora|imprimir|impressão|driver.*impress/.test(t)) return 'Impressora'

  // ── Cadastros / Configuração bancária ─────────────────────────────
  if (/cnab|arquivo de remessa|arquivo de retorno|remessa bancária/.test(t)) return 'CNAB / Remessa'
  if (/convênio bancário|configurar boleto|layout.*boleto|registrar boleto|registro.*boleto/.test(t)) return 'Convênio Bancário'
  if (/cadastr.*cliente|cadastr.*produto|cadastrar item|cadastrar fornecedor/.test(t)) return 'Cadastro Cliente/Produto'

  // ── Acesso ────────────────────────────────────────────────────────
  if (/esqueci.*senha|resetar senha|senha incorreta|recuperar senha|reset.*senha/.test(t)) return 'Senha / Login'
  if (/usuário bloqueado|usuario bloqueado|conta bloqueada|bloqueio.*usuário/.test(t)) return 'Bloqueio de Usuário'

  // ── Caixa / Vendas ────────────────────────────────────────────────
  if (/\btef\b/.test(t)) return 'TEF'
  if (/cancelar venda|estornar|estorno/.test(t)) return 'Cancelamento Venda'
  if (/caixa não abre|caixa nao abre|fechar caixa|sangria|suprimento|abertura de caixa|fechamento.*caixa/.test(t)) return 'Caixa / Fechamento'

  // ── Estoque ───────────────────────────────────────────────────────
  if (/estoque|inventário|inventario|movimentação.*estoque/.test(t)) return 'Estoque / Inventário'

  // ── Integração ────────────────────────────────────────────────────
  if (/integração|integracao|\bapi\b|webhook|e-commerce|ecommerce/.test(t)) return 'Integração / API'

  // ── Operacional genérico (último recurso) ─────────────────────────
  if (/instalação|reinstalação|formatação|instalar/.test(t)) return 'Instalação'
  if (/atualização|atualizacao|\bupdate\b|versão.*nova|upgrade/.test(t)) return 'Atualização / Versão'
  if (/servidor|\brede\b|conexão|firewall|sem internet/.test(t)) return 'Servidor / Rede'
  if (/relatório|consulta/.test(t)) return 'Relatório'
  if (/treinamento|como fazer|como usar|tutorial/.test(t)) return 'Treinamento'

  return 'Suporte geral'
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
