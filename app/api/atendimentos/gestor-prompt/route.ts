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
import type { AtendimentoRecord } from '@/lib/types'

// Vercel: estende o timeout da Function pra acomodar retries em 429.
// 60s é o teto do plano Pro. No Hobby (default 10s) o efeito é nulo, mas
// também não atrapalha — o retry foi calibrado pra caber em 10s no pior caso.
export const maxDuration = 60

// O iarouter exige prefixo de provider (ex: cc/claude-opus-4-6).
// Adiciona 'cc/' automaticamente quando o modelo vem sem prefixo.
function resolveIarouterModel(): string {
  const raw = process.env.IAROUTER_MODEL?.trim() || 'claude-opus-4-6'
  return raw.includes('/') ? raw : `cc/${raw}`
}

// Extrai "reset after Xs" da mensagem do iarouter pra devolver ao cliente
// quanto tempo aguardar antes de tentar de novo.
function parseResetSeconds(message: string): number {
  const match = message.match(/reset after (\d+)s/i)
  if (match) return Math.min(parseInt(match[1], 10), 30)
  return 5
}

function resolveIarouterBaseUrl(): string {
  return process.env.IAROUTER_BASE_URL?.trim() || 'https://iarouter.softcomia.com/v1'
}

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

Limite-se a no máximo 5 sugestões, priorizando as de maior impacto. Se algum atendimento não trouxer aprendizado novo, ignore. Seja conciso — cada sugestão direto ao ponto.`

function buildAtendimentoSummary(a: AtendimentoRecord): string {
  const lines: string[] = []
  lines.push(`### Atendimento #${a.id}${a.id_ligacao ? ` (${a.id_ligacao})` : ''}`)
  lines.push(`- Status: ${a.status ?? '—'}`)
  if (a.destino) lines.push(`- Destino: ${a.destino}`)
  if (a.nome_empresa) lines.push(`- Empresa: ${a.nome_empresa}`)
  if (a.sentimento_cliente) lines.push(`- Sentimento: ${a.sentimento_cliente}`)
  // duracao_segundos vem do banco em ms; converte pra segundos no resumo da IA
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
    // 800 chars cabe ligações inteiras e os trechos mais relevantes de chats
    // longos, sem estourar o tempo de processamento do modelo.
    const truncated = String(transcript).slice(0, 800)
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

  // Chave do servidor (IAROUTER_API_KEY ou ANTHROPIC_API_KEY) tem precedência;
  // cliente pode mandar via header x-anthropic-key como fallback.
  const headerKey = request.headers.get('x-anthropic-key')?.trim() || null
  const apiKey =
    process.env.IAROUTER_API_KEY?.trim() ||
    process.env.ANTHROPIC_API_KEY?.trim() ||
    headerKey

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
    // Sempre roteia pelo IAROUTER (proxy Anthropic-compatível da Softcom).
    // Não reutilizamos o singleton de lib/anthropic pra não vazar a chave do
    // cliente nem misturar baseURL com outros consumidores.
    const client = new Anthropic({
      apiKey,
      baseURL: resolveIarouterBaseUrl(),
    })
    const model = resolveIarouterModel()
    console.log('[gestor-prompt] enviando para iarouter (stream):', {
      baseUrl: resolveIarouterBaseUrl(),
      model,
      inputChars: userMessage.length,
    })

    // Streaming: a Function retorna o ReadableStream imediatamente. O tempo
    // gasto enquanto o conteúdo flui NÃO conta pro timeout da Vercel, então
    // podemos esperar respostas longas do Opus sem estourar 10s.
    //
    // Enviamos só o texto bruto acumulado da resposta. O cliente parseia o
    // JSON depois que o stream termina.
    const anthropicStream = client.messages.stream({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const startTime = Date.now()
        try {
          for await (const event of anthropicStream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta' &&
              event.delta.text
            ) {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          console.log('[gestor-prompt] stream completo em', Date.now() - startTime, 'ms')
          controller.close()
        } catch (err) {
          console.error('[gestor-prompt] erro no stream:', err)
          // Em vez de quebrar, anexa um marcador no stream pra o cliente
          // detectar que houve erro depois.
          const msg = err instanceof Error ? err.message : String(err)
          const errPayload = `\n\n__STREAM_ERROR__${JSON.stringify({
            status: (err as { status?: number })?.status,
            message: msg,
          })}__END__`
          controller.enqueue(encoder.encode(errPayload))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao chamar Claude'
    const status = (err as { status?: number })?.status
    if (status === 429 || /429|rate.?limit/i.test(msg)) {
      const retryAfter = parseResetSeconds(msg) + 1
      return Response.json(
        {
          error: `Limite de requisições atingido. Tentando novamente em ${retryAfter}s...`,
          retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }
    return Response.json({ error: msg }, { status: 500 })
  }
}

