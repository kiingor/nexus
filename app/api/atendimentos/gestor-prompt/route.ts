/**
 * POST /api/atendimentos/gestor-prompt
 *
 * Body: { currentPrompt: string, atendimentoIds: number[] }
 *
 * Lê os atendimentos do Supabase, manda pro Claude e devolve
 * uma lista de sugestões separadas para serem aplicadas ao prompt.
 *
 * Resposta: { suggestions: Suggestion[] }
 */

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/anthropic'
import type { AtendimentoRecord } from '@/lib/types'

export interface PromptSuggestion {
  id: string
  titulo: string
  categoria: 'cobertura' | 'tom' | 'roteiro' | 'erro_comum' | 'extracao' | 'outro'
  insight: string // por que (com base nos atendimentos)
  trecho_a_adicionar: string // texto sugerido para inserir/adicionar
  exemplo_atendimento: string | null // resumo do atendimento que motivou
  posicao_sugerida: 'inicio' | 'fim' | 'secao_existente'
}

interface RequestBody {
  currentPrompt?: string
  atendimentoIds?: number[]
}

const SYSTEM_PROMPT = `Você é um especialista em engenharia de prompts para agentes de IA conversacionais de atendimento ao cliente (PT-BR).

Você recebe:
1. Um PROMPT_ATUAL usado por um agente de voz que atende clientes
2. Um conjunto de ATENDIMENTOS reais (transcrições, problema, status, sentimento, custo, análise estruturada)

Sua tarefa é analisar os atendimentos e propor MELHORIAS PONTUAIS e SEPARADAS para o prompt — cada sugestão deve ser independente e poder ser aplicada isoladamente.

Cada sugestão deve:
- Ser concreta e acionável (não genérica)
- Ter um título curto descritivo
- Justificar com base em algo observado nos atendimentos (insight)
- Trazer o trecho exato em PT-BR que o usuário poderá colar/inserir no prompt
- Indicar se vai no início, fim ou complementa uma seção existente
- Identificar uma categoria entre: cobertura (cobrir cenário não tratado), tom (ajustar linguagem), roteiro (mudar fluxo de fala), erro_comum (evitar problema recorrente), extracao (melhorar coleta de dados), outro

Devolva APENAS JSON válido no formato:
{
  "suggestions": [
    {
      "id": "s1",
      "titulo": "...",
      "categoria": "cobertura",
      "insight": "...",
      "trecho_a_adicionar": "...",
      "exemplo_atendimento": "Atendimento #123 — empresa X",
      "posicao_sugerida": "fim"
    }
  ]
}

Limite-se a no máximo 8 sugestões, priorizando as de maior impacto. Se algum atendimento não trouxer aprendizado novo, ignore.`

function buildAtendimentoSummary(a: AtendimentoRecord): string {
  const lines: string[] = []
  lines.push(`### Atendimento #${a.id}${a.id_ligacao ? ` (${a.id_ligacao})` : ''}`)
  lines.push(`- Status: ${a.status ?? '—'}`)
  if (a.destino) lines.push(`- Destino: ${a.destino}`)
  if (a.nome_empresa) lines.push(`- Empresa: ${a.nome_empresa}`)
  if (a.sentimento_cliente) lines.push(`- Sentimento: ${a.sentimento_cliente}`)
  if (a.duracao_segundos != null) lines.push(`- Duração: ${a.duracao_segundos}s`)
  if (a.problema_relatado) lines.push(`- Problema relatado: ${a.problema_relatado}`)
  if (a.solucao_aplicada) lines.push(`- Solução aplicada: ${a.solucao_aplicada}`)
  const pe = a.problema_extraido
  if (pe?.tem_problema_extraivel && pe.problema) {
    lines.push(
      `- Análise: categoria=${pe.problema.categoria ?? '?'}, módulo=${pe.problema.modulo_afetado ?? '?'}, frequência=${pe.problema.frequencia ?? '?'}`
    )
    if (pe.problema.mensagem_erro) lines.push(`  Erro: ${pe.problema.mensagem_erro}`)
  } else if (pe?.motivo_descarte) {
    lines.push(`- Sem problema extraível (${pe.motivo_descarte})`)
  }
  const transcript = a.transcricao_formatada || a.transcricao
  if (transcript) {
    const truncated = String(transcript).slice(0, 1500)
    lines.push(`- Transcrição (truncada):\n${truncated}`)
  }
  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const currentPrompt = (body.currentPrompt || '').trim()
  const ids = Array.isArray(body.atendimentoIds) ? body.atendimentoIds : []

  if (!currentPrompt) {
    return Response.json({ error: 'currentPrompt é obrigatório' }, { status: 400 })
  }
  if (ids.length === 0) {
    return Response.json({ error: 'Selecione ao menos 1 atendimento' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: atendimentos, error } = await supabase
    .from('atendimentos')
    .select('*')
    .in('id', ids)
    .limit(50)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!atendimentos || atendimentos.length === 0) {
    return Response.json({ error: 'Nenhum atendimento encontrado' }, { status: 404 })
  }

  // Chave do servidor tem precedência; cliente pode mandar via header como fallback
  const headerKey = request.headers.get('x-anthropic-key')?.trim() || null
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || headerKey

  if (!apiKey) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY não configurada no servidor' },
      { status: 503 }
    )
  }

  const summaries = (atendimentos as AtendimentoRecord[]).map(buildAtendimentoSummary).join('\n\n')

  const userMessage = `# PROMPT_ATUAL

\`\`\`
${currentPrompt}
\`\`\`

# ATENDIMENTOS SELECIONADOS

${summaries}

# TAREFA
Analise os atendimentos acima e proponha melhorias separadas para o PROMPT_ATUAL no formato JSON especificado.`

  try {
    // Usa client do servidor quando a chave vem do env, senão instancia
    // um novo com a chave do header (não mantém singleton com chave de cliente)
    const client = process.env.ANTHROPIC_API_KEY
      ? getAnthropicClient()
      : new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')

    // Extrai JSON tolerante a wrapping em markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return Response.json(
        { error: 'Resposta da IA sem JSON válido', raw: text },
        { status: 502 }
      )
    }

    let parsed: { suggestions?: PromptSuggestion[] }
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return Response.json(
        { error: 'JSON da IA inválido', raw: text },
        { status: 502 }
      )
    }

    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
    return Response.json({ suggestions })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao chamar Claude'
    return Response.json({ error: msg }, { status: 500 })
  }
}

