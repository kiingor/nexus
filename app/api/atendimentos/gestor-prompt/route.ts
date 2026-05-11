/**
 * POST /api/atendimentos/gestor-prompt
 *
 * Body: { currentPrompt: string, atendimentoIds: number[] }
 *
 * Lê os atendimentos do Supabase, manda pro GPT (OpenAI) e devolve
 * uma lista de sugestões separadas para serem aplicadas ao prompt.
 *
 * Resposta: { suggestions: Suggestion[] }
 */

import OpenAI from 'openai'
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { AtendimentoRecord } from '@/lib/types'

// Vercel: 60s é o teto do plano Hobby. GPT-4.1 responde tipicamente em
// 5-15s mesmo com inputs grandes, então sobra folga.
export const maxDuration = 60

// Modelo padrão. Configurável via env (GESTOR_PROMPT_MODEL) caso queira
// trocar pra gpt-4o, gpt-4.1-mini etc sem rebuild.
const DEFAULT_MODEL = 'gpt-4.1'

export interface PromptSuggestion {
  id: string
  titulo: string
  categoria: 'cobertura' | 'tom' | 'roteiro' | 'erro_comum' | 'extracao' | 'outro'
  insight: string
  trecho_a_adicionar: string
  exemplo_atendimento: string | null
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
  if (a.duracao_segundos != null)
    lines.push(`- Duração: ${Math.round(a.duracao_segundos / 1000)}s`)
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

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return Response.json(
      { error: 'OPENAI_API_KEY não configurada no servidor' },
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
    const client = new OpenAI({ apiKey })
    const model = process.env.GESTOR_PROMPT_MODEL?.trim() || DEFAULT_MODEL
    const startTime = Date.now()
    console.log('[gestor-prompt] enviando para OpenAI:', {
      model,
      inputChars: userMessage.length,
    })

    // response_format json_object garante que a resposta é JSON válido —
    // a OpenAI bloqueia o output até que esteja parseável. Elimina toda
    // a complexidade de parser tolerante que tínhamos com Claude.
    const response = await client.chat.completions.create({
      model,
      temperature: 0.4,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    })

    const elapsed = Date.now() - startTime
    console.log('[gestor-prompt] resposta em', elapsed, 'ms')

    const text = response.choices[0]?.message?.content
    if (!text) {
      return Response.json({ error: 'OpenAI não devolveu conteúdo' }, { status: 502 })
    }

    let parsed: { suggestions?: PromptSuggestion[] }
    try {
      parsed = JSON.parse(text)
    } catch {
      console.error('[gestor-prompt] JSON inválido (improvável com json_object):', text)
      return Response.json({ error: 'JSON da IA inválido', raw: text }, { status: 502 })
    }

    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
    return Response.json({ suggestions })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao chamar OpenAI'
    const status = (err as { status?: number })?.status
    console.error('[gestor-prompt] erro:', { status, msg })

    if (status === 429 || /rate.?limit/i.test(msg)) {
      return Response.json(
        { error: 'Limite de requisições da OpenAI atingido. Tente novamente em alguns segundos.' },
        { status: 429 }
      )
    }
    if (status === 401 || status === 403) {
      return Response.json(
        { error: 'Chave da OpenAI inválida ou sem permissão. Verifique OPENAI_API_KEY no servidor.' },
        { status: status }
      )
    }
    return Response.json({ error: msg }, { status: 500 })
  }
}
