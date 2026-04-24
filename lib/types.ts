// ── Database Entities ──

export interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  created_at: string
  created_by: string
}

export interface Module {
  id: string
  product_id: string
  name: string
  type: 'instruction' | 'error'
  description: string | null
  keywords: string[]
  created_at: string
}

export interface KnowledgeItem {
  id: string
  module_id: string
  title: string
  type: 'instruction' | 'error'
  content: InstructionContent | ErrorContent
  keywords: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── Content Schemas ──

export interface InstructionStep {
  passo: number
  acao: string
  orientacao: string | null
  atalho: string | null
}

export interface InstructionContent {
  type: 'instruction'
  steps: InstructionStep[]
}

export interface ErrorContent {
  type: 'error'
  error_code: string | null
  description: string
  cause: string
  solution: string
  orientation: string | null
}

// ── API Types ──

export interface ProductWithCounts extends Product {
  module_count: number
  item_count: number
}

export interface ModuleWithCount extends Module {
  item_count: number
}

// ── Export Schema ──

export interface ExportData {
  produto: string
  exportado_em: string
  instrucoes: ExportInstruction[]
  erros: ExportError[]
}

export interface ExportInstruction {
  modulo: string
  titulo: string
  palavras_chave: string[]
  passos: {
    passo: number
    acao: string
    orientacao: string | null
    atalho: string | null
  }[]
}

export interface ExportError {
  modulo: string
  titulo: string
  palavras_chave: string[]
  codigo: string | null
  descricao: string
  causa: string
  solucao: string
  orientacao: string | null
}

// ── Chat Types ──

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ── Monitoria Types ──

export interface QuestionarioCriterio {
  criterio: string
  nota: number
  peso: number
  justificativa: string
}

export interface QuestionarioAvaliacao {
  criterios: QuestionarioCriterio[]
  pontos_fortes: string[]
  pontos_melhoria: string[]
  resumo: string
}

// Questionario pode vir como string (formato do n8n) ou objeto estruturado (legado)
export type Questionario = string | QuestionarioAvaliacao | null

export interface QuestionarioItem {
  criterio: string
  status: string // "Sim" | "Não" | "NA" | outro
  justificativa: string
}

export interface QuestionarioParsed {
  resumo: string
  items: QuestionarioItem[]
}

export interface MonitoriaRecord {
  id: string
  nota_avaliacao: number | string | null
  data_avaliacao: string | null
  transcricao: string | null
  nota_cliente: number | string | null
  ramal: string | null
  numero_contato: string | null
  questionario: Questionario
  created_at: string
}

export interface MonitoriaInput {
  nota_avaliacao?: number | string | null
  data_avaliacao?: string | null
  transcricao?: string | null
  nota_cliente?: number | string | null
  ramal?: string | null
  numero_contato?: string | null
  questionario?: Questionario
}

// ── Atendimentos (Central de Ligações Suporte IA) ──

export type AtendimentoStatus = 'transferida' | 'resolvida_ia' | 'interrompida'
export type AtendimentoDestino = 'servicedesk' | 'financeiro' | null

export interface ProblemaExtraidoDetalhe {
  categoria?: string | null
  modulo_afetado?: string | null
  descricao_tecnica?: string | null
  descricao_cliente?: string | null
  acao_que_disparou?: string | null
  mensagem_erro?: string | null
  frequencia?: string | null
  impacto_relatado?: string | null
}

export interface ProblemaExtraido {
  tem_problema_extraivel: boolean
  motivo_descarte?: string | null
  problema?: ProblemaExtraidoDetalhe | null
  citacoes_relevantes?: string[] | null
  confianca?: 'alta' | 'media' | 'baixa' | string | null
}

export interface AtendimentoRecord {
  id: number
  id_ligacao: string | null
  status: AtendimentoStatus | string | null
  destino: AtendimentoDestino | string | null
  cnpj: string | null
  nome_empresa: string | null
  cliente_nome: string | null
  phone: string | null
  whatsapp_contato: string | null
  numero_anydesk: string | null
  problema_relatado: string | null
  solucao_aplicada: string | null
  transcricao: string | null
  turno_agente: string | null
  turno_cliente: string | null
  transcricao_formatada: string | null
  data_hora_chegada: string | null
  data_hora_saida: string | null
  duracao_segundos: number | null
  problema_extraido: ProblemaExtraido | null
  resolvibilidade: Record<string, unknown> | null
  criado_em: string | null
}

export interface AvaliacaoAtendimentoRecord {
  id: number
  nota: number | null
  phone: string | null
  cnpj: string | null
  name_assistente: string | null
  id_atendimento: number | null
  criado_em: string | null
}
