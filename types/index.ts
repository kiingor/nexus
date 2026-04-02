// ─── Database types ───────────────────────────────────────────────────────────

export type ModuleType = 'instruction' | 'error';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  created_by: string;
  // virtual counts (from joins)
  module_count?: number;
  item_count?: number;
}

export interface Module {
  id: string;
  product_id: string;
  name: string;
  type: ModuleType;
  description: string | null;
  created_at: string;
  // virtual counts
  item_count?: number;
}

// Content schemas ─────────────────────────────────────────────────────────────

export interface InstructionStep {
  passo: number;
  acao: string;
  orientacao: string | null;
  atalho: string | null;
}

export interface InstructionContent {
  type: 'instruction';
  steps: InstructionStep[];
}

export interface ErrorContent {
  type: 'error';
  error_code: string | null;
  description: string;
  cause: string;
  solution: string;
  orientation: string | null;
}

export type KnowledgeContent = InstructionContent | ErrorContent;

export interface KnowledgeItem {
  id: string;
  module_id: string;
  title: string;
  type: ModuleType;
  content: KnowledgeContent;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── API/UI types ─────────────────────────────────────────────────────────────

export interface CreateProductInput {
  name: string;
  description?: string;
}

export interface CreateModuleInput {
  product_id: string;
  name: string;
  type: ModuleType;
  description?: string;
}

export interface CreateKnowledgeItemInput {
  module_id: string;
  title: string;
  type: ModuleType;
  content: KnowledgeContent;
}

// ─── Export types ─────────────────────────────────────────────────────────────

export interface ExportStep {
  passo: number;
  acao: string;
  orientacao?: string;
  atalho?: string;
}

export interface ExportInstruction {
  modulo: string;
  titulo: string;
  passos: ExportStep[];
}

export interface ExportError {
  modulo: string;
  titulo: string;
  codigo?: string;
  descricao: string;
  causa: string;
  solucao: string;
  orientacao?: string;
}

export interface ExportPayload {
  produto: string;
  exportado_em: string;
  instrucoes: ExportInstruction[];
  erros: ExportError[];
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}
