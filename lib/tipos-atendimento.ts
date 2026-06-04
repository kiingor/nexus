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
