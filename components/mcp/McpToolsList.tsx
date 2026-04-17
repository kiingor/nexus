'use client'

import { Wrench } from 'lucide-react'

const TOOLS = [
  {
    name: 'search_knowledge',
    description: 'Busca semântica (RAG) na base de conhecimento. Retorna trechos relevantes ordenados por similaridade, sem invocar LLM.',
    inputs: ['query', 'product_slug?', 'limit?', 'match_threshold?'],
  },
  {
    name: 'chat_with_knowledge',
    description: 'Pergunta ao assistente do Nexus. Faz RAG + resposta via LLM (GPT-4.1-mini por padrão).',
    inputs: ['message', 'product_slug?', 'model?', 'history?'],
  },
  {
    name: 'list_products',
    description: 'Lista produtos cadastrados com contagem de módulos e itens.',
    inputs: [],
  },
  {
    name: 'list_modules',
    description: 'Lista módulos de um produto específico.',
    inputs: ['product_slug'],
  },
  {
    name: 'create_knowledge_item',
    description: 'Cria uma instrução ou erro em um módulo. Dispara embedding em background.',
    inputs: ['product_slug', 'module_id', 'title', 'type', 'content', 'keywords?'],
  },
]

export function McpToolsList() {
  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4">
        <Wrench size={18} className="text-orange-400" />
        <h2 className="text-lg font-display font-bold text-primary">Tools disponíveis</h2>
        <span className="text-xs text-muted">({TOOLS.length})</span>
      </div>

      <div className="space-y-3">
        {TOOLS.map((t) => (
          <div key={t.name} className="glass p-3">
            <div className="flex items-start justify-between gap-3 mb-1.5 flex-wrap">
              <code className="text-sm font-mono font-semibold text-orange-400">{t.name}</code>
              {t.inputs.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {t.inputs.map((inp) => (
                    <code
                      key={inp}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-glass border border-glass-border text-secondary"
                    >
                      {inp}
                    </code>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-secondary leading-relaxed">{t.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
