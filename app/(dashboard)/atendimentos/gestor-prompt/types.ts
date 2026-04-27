// Compartilhado entre a página e a API de gestor-prompt

export interface PromptSuggestion {
  id: string
  titulo: string
  categoria: 'cobertura' | 'tom' | 'roteiro' | 'erro_comum' | 'extracao' | 'outro'
  insight: string
  trecho_a_adicionar: string
  exemplo_atendimento: string | null
  posicao_sugerida: 'inicio' | 'fim' | 'secao_existente'
}
