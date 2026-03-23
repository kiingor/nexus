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
  created_at: string
}

export interface KnowledgeItem {
  id: string
  module_id: string
  title: string
  type: 'instruction' | 'error'
  content: InstructionContent | ErrorContent
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
