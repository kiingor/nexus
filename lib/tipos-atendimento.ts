// Mapa código → label amigável dos tipos de atendimento.
// O código é o que o classificador AI do n8n grava na coluna
// atendimentos.tipo_atendimento. O label é exibido no UI.
//
// Mantém alinhado com a lista do prompt do AI Agent (sub-classificador):
// servicedesk (18), financeiro (6), ouvidoria (2), comercial (2) = 28 tipos.

export const TIPO_ATENDIMENTO_LABELS: Record<string, string> = {
  // ─── ServiceDesk
  certificado_digital: 'Certificado Digital',
  vendas: 'Vendas',
  notas_nfe_nfce: 'Notas NFe/NFCe',
  impressora: 'Impressora',
  balanca_etiqueta: 'Balança/Etiqueta',
  tecnico_especifico: 'Técnico Específico',
  sped: 'SPED',
  sistema_nao_abre: 'Sistema não abre',
  treinamento: 'Treinamento',
  estoque_balanco: 'Ajuste de Estoque/Balanço',
  inventario: 'Inventário',
  duvidas_fiscais: 'Dúvidas Fiscais',
  nota_servico: 'Nota de Serviço',
  mdfe: 'MDFe',
  cadastros: 'Cadastros',
  instalacao: 'Instalação',
  relatorios: 'Relatórios',
  suporte_geral: 'Suporte Geral',
  // ─── Financeiro
  erro_337: 'Cliente Bloqueado (Erro 337)',
  boleto_mensalidade: 'Boleto/Mensalidade',
  liberacao_sistema: 'Liberação de Sistema',
  renegociacao: 'Renegociação',
  aumento_mensalidade: 'Aumento de Mensalidade',
  pix: 'PIX',
  // ─── Ouvidoria
  cancelamento: 'Cancelamento',
  insatisfacao: 'Insatisfação',
  // ─── Comercial
  upgrade: 'Upgrade',
  cliente_novo: 'Cliente Novo',
}

// ── Canonicalização de motivos ──────────────────────────────────────
//
// O dashboard mistura duas taxonomias: os labels do n8n
// (TIPO_ATENDIMENTO_LABELS) e as categorias do regex `classifyMotivo`
// (MOTIVO_CATEGORIES em lib/atendimentos.ts). As duas nomeiam o mesmo
// motivo de formas diferentes ("Suporte geral" x "Suporte Geral",
// "Boleto / Mensalidade" x "Boleto/Mensalidade"), o que gerava buckets
// duplicados. `motivoCanonico` reduz qualquer label a um rótulo único.

// Normaliza pra comparar: minúsculas, sem espaço em volta da barra,
// espaços colapsados. Resolve os pares que só diferem em caixa/barra.
function normMotivo(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
}

// Forma normalizada de cada label do n8n → o próprio label (canônico).
const CANON_BY_NORM: Record<string, string> = Object.fromEntries(
  Object.values(TIPO_ATENDIMENTO_LABELS).map((label) => [normMotivo(label), label])
)

// Sinônimos das categorias do regex que usam palavras diferentes do label
// do n8n, mas são o mesmo motivo. Chave = forma normalizada do label regex.
const SINONIMOS_MOTIVO: Record<string, string> = {
  'falar com técnico específico': 'Técnico Específico',
  'sped fiscal': 'SPED',
  'relatório': 'Relatórios',
  'erro 337 (boleto)': 'Cliente Bloqueado (Erro 337)',
  'configuração fiscal': 'Dúvidas Fiscais',
  'estoque/inventário': 'Ajuste de Estoque/Balanço',
  'cadastro cliente/produto': 'Cadastros',
  // Variantes fiscais de NF-e — o n8n as trata como um único tipo.
  'nfc-e': 'Notas NFe/NFCe',
  'nf-e rejeitada': 'Notas NFe/NFCe',
  'erro emissão nf-e': 'Notas NFe/NFCe',
  'cancelamento nf-e': 'Notas NFe/NFCe',
  'carta de correção': 'Notas NFe/NFCe',
  'sat/cf-e': 'Notas NFe/NFCe',
}

// Rótulo canônico de um motivo, venha ele do n8n ou do regex. Labels sem
// par conhecido são devolvidos como estão (não duplicam nada).
export function motivoCanonico(label: string): string {
  const n = normMotivo(label)
  return SINONIMOS_MOTIVO[n] ?? CANON_BY_NORM[n] ?? label
}

// Converte código → label amigável. Se for desconhecido, "humaniza"
// o próprio código (snake_case → Title Case) pra não ficar feio.
export function formatTipoAtendimento(codigo: string | null | undefined): string {
  if (!codigo) return '—'
  const known = TIPO_ATENDIMENTO_LABELS[codigo]
  if (known) return known
  return codigo
    .split('_')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}
