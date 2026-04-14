/**
 * Script para melhorar dataset de fine-tuning usando distillation com GPT-4o.
 *
 * Uso:
 *   npx tsx scripts/distill-training-data.ts
 *   npx tsx scripts/distill-training-data.ts --input=finetune-softcom-expanded.jsonl
 *
 * Lê o JSONL existente, usa GPT-4o como teacher para gerar respostas melhores
 * em batches (vários exemplos por chamada para eficiência).
 *
 * Gera: finetune-softcom-distilled.jsonl
 */

import OpenAI from 'openai'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// 1. Carregar .env.local
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('Arquivo .env.local não encontrado!')
    process.exit(1)
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnv()

// ---------------------------------------------------------------------------
// 2. Configuração
// ---------------------------------------------------------------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const args = process.argv.slice(2)
const inputArg = args.find((a) => a.startsWith('--input='))?.split('=')[1]
const INPUT_FILE = path.resolve(process.cwd(), inputArg || 'finetune-softcom-expanded.jsonl')
const OUTPUT_FILE = path.resolve(process.cwd(), 'finetune-softcom-distilled.jsonl')
const DISTILL_BATCH = 8   // exemplos por chamada de distillation
const VARIANT_BATCH = 5   // exemplos por chamada de geração de variantes
const DELAY_MS = 1500

// ---------------------------------------------------------------------------
// 3. Tipos
// ---------------------------------------------------------------------------
interface TrainingExample {
  messages: Array<{ role: string; content: string }>
}

interface DistillItem {
  index: number
  user: string
  assistant: string
  product: string
  module: string
}

// ---------------------------------------------------------------------------
// 4. System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Você é um assistente técnico especializado nos sistemas Softcom. Existem 2 produtos principais:
1. **Softshop** — sistema de gestão comercial (retaguarda) com módulos internos (Cadastros, Vendas, Compras, Orçamento, Notas Fiscais, Utilitários, Ajustes de Estoque). Além disso, possui módulos que precisam ser instalados separadamente: Emissor, Sped, PDV, TEF e SoftcomChef.
2. **Softcomshop** — sistema de gestão comercial online com módulos internos (Compras e Estoque, Configurações, Relatórios, Vendas e NFe). Também utiliza os módulos instalados separadamente: PDV, TEF e SoftcomChef.

Os módulos PDV, TEF e SoftcomChef são compartilhados entre Softshop e Softcomshop e precisam ser instalados à parte. O Emissor e o Sped são módulos exclusivos do Softshop, também instalados separadamente.

Sempre identifique corretamente a qual produto e módulo a instrução se refere. Se o usuário não especificar qual produto usa, pergunte antes de responder. Responda de forma clara e objetiva com o passo a passo. Se uma funcionalidade não existe em determinado produto, informe isso claramente.`

// ---------------------------------------------------------------------------
// 5. Parse input
// ---------------------------------------------------------------------------
function parseInput(): DistillItem[] {
  const lines = fs.readFileSync(INPUT_FILE, 'utf-8').trim().split('\n')
  const items: DistillItem[] = []

  for (let i = 0; i < lines.length; i++) {
    const parsed = JSON.parse(lines[i]) as TrainingExample
    const userMsg = parsed.messages.find((m) => m.role === 'user')
    const assistantMsg = parsed.messages.find((m) => m.role === 'assistant')
    if (!userMsg || !assistantMsg) continue

    const productMatch = assistantMsg.content.match(/\*\*Produto:\*\* (.+?)(?:\n|$)/)
    const moduleMatch = assistantMsg.content.match(/\*\*Módulo:\*\* (.+?)(?:\n|$)/)

    items.push({
      index: i,
      user: userMsg.content,
      assistant: assistantMsg.content,
      product: productMatch?.[1]?.trim() || 'N/A',
      module: moduleMatch?.[1]?.trim() || 'N/A',
    })
  }

  return items
}

// ---------------------------------------------------------------------------
// 6. Distill batch (JSON mode)
// ---------------------------------------------------------------------------
async function distillBatch(items: DistillItem[]): Promise<string[]> {
  const itemsText = items
    .map(
      (item, i) =>
        `### EXEMPLO ${i}\nPergunta: ${item.user}\nProduto: ${item.product}\nMódulo: ${item.module}\nResposta atual:\n${item.assistant}`,
    )
    .join('\n\n---\n\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Você é um professor especialista em suporte técnico dos sistemas Softcom. Melhore as respostas do assistente para cada exemplo dado.

Formato de saída JSON:
{
  "improvements": [
    { "index": 0, "improved_response": "texto melhorado" },
    { "index": 1, "improved_response": "texto melhorado" }
  ]
}

Cada improved_response deve:
- Começar com **Produto:** e **Módulo:** corretos
- Ter passos numerados com ações claras
- Incluir *Orientação:* com detalhes de UI quando relevante
- Incluir *Atalho:* com teclas de atalho quando conhecidas
- Ser mais detalhado e útil que a resposta original
- Manter o mesmo idioma (português)`,
      },
      {
        role: 'user',
        content: `Melhore estas ${items.length} respostas:\n\n${itemsText}`,
      },
    ],
  })

  const content = response.choices[0]?.message?.content?.trim()
  if (!content) {
    console.warn('  Resposta vazia do GPT-4o, usando respostas originais')
    return items.map((item) => item.assistant)
  }

  try {
    const parsed = JSON.parse(content) as { improvements: Array<{ index: number; improved_response: string }> }
    const result: string[] = []
    for (const item of items) {
      const improvement = parsed.improvements?.find((imp) => imp.index === items.indexOf(item))
      result.push(improvement?.improved_response?.trim() || item.assistant)
    }
    return result
  } catch (e) {
    console.warn('  Falha ao parsear JSON, usando respostas originais:', (e as Error).message)
    return items.map((item) => item.assistant)
  }
}

// ---------------------------------------------------------------------------
// 7. Generate ambiguous variants (JSON mode)
// ---------------------------------------------------------------------------
async function generateAmbiguousVariants(items: DistillItem[]): Promise<TrainingExample[]> {
  const itemsText = items
    .map(
      (item, i) =>
        `### EXEMPLO ${i}\nPergunta original: ${item.user}\nProduto: ${item.product}\nMódulo: ${item.module}`,
    )
    .join('\n\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.7,
    max_tokens: 3000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Gere variações AMBÍGUAS de perguntas sobre o sistema Softcom — perguntas onde o usuário NÃO especifica se usa Softshop ou Softcomshop.

Formato de saída JSON:
{
  "variants": [
    {
      "index": 0,
      "ambiguous_question": "pergunta ambígua",
      "assistant_response": "resposta que pergunta qual produto + procedimento genérico"
    }
  ]
}

Para cada exemplo dado, gere 1 pergunta ambígua. A resposta do assistente deve:
1. Perguntar qual produto o usuário usa
2. Dar um procedimento genérico enquanto isso
3. Manter o formato **Produto:**, **Módulo:**, passos, etc.`,
      },
      {
        role: 'user',
        content: `Gere perguntas ambíguas para:\n\n${itemsText}`,
      },
    ],
  })

  const content = response.choices[0]?.message?.content?.trim()
  if (!content) return []

  try {
    const parsed = JSON.parse(content) as { variants: Array<{ index: number; ambiguous_question: string; assistant_response: string }> }
    const variants: TrainingExample[] = []
    for (const v of parsed.variants || []) {
      const sourceItem = items[v.index]
      if (sourceItem) {
        variants.push({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: v.ambiguous_question },
            { role: 'assistant', content: v.assistant_response },
          ],
        })
      }
    }
    return variants
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// 8. Generate multi-turn conversations (JSON mode)
// ---------------------------------------------------------------------------
async function generateMultiTurn(items: DistillItem[]): Promise<TrainingExample[]> {
  const itemsText = items
    .map(
      (item, i) =>
        `### EXEMPLO ${i}\nPergunta: ${item.user}\nResposta melhorada:\n${item.assistant}`,
    )
    .join('\n\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.5,
    max_tokens: 3000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Gere conversas multi-turn (2 trocas) sobre os tópicos dados.

Formato de saída JSON:
{
  "conversations": [
    {
      "index": 0,
      "follow_up_question": "pergunta natural de follow-up",
      "follow_up_answer": "resposta ao follow-up"
    }
  ]
}

Para cada exemplo, gere um follow-up natural que alguém faria após receber a primeira resposta.
A resposta ao follow-up deve manter o formato: **Produto:**, **Módulo:**, passos, *Orientação:*, *Atalho:*`,
      },
      {
        role: 'user',
        content: `Gere follow-ups para:\n\n${itemsText}`,
      },
    ],
  })

  const content = response.choices[0]?.message?.content?.trim()
  if (!content) return []

  try {
    const parsed = JSON.parse(content) as { conversations: Array<{ index: number; follow_up_question: string; follow_up_answer: string }> }
    const conversations: TrainingExample[] = []
    for (const c of parsed.conversations || []) {
      const sourceItem = items[c.index]
      if (sourceItem) {
        conversations.push({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: sourceItem.user },
            { role: 'assistant', content: sourceItem.assistant },
            { role: 'user', content: c.follow_up_question },
            { role: 'assistant', content: c.follow_up_answer },
          ],
        })
      }
    }
    return conversations
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// 9. Helpers
// ---------------------------------------------------------------------------
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// 10. Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Nexus - Distillation de Dataset ===\n')

  const items = parseInput()
  console.log(`Arquivo de entrada: ${INPUT_FILE}`)
  console.log(`Exemplos existentes:  ${items.length}\n`)

  // --- Phase 1: Distill all examples ---
  console.log('=== Fase 1: Melhorando respostas com GPT-4o ===')
  const distilled: TrainingExample[] = []

  for (let i = 0; i < items.length; i += DISTILL_BATCH) {
    const batch = items.slice(i, i + DISTILL_BATCH)
    const improved = await distillBatch(batch)

    for (let j = 0; j < batch.length; j++) {
      distilled.push({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: batch[j].user },
          { role: 'assistant', content: improved[j] },
        ],
      })
    }

    console.log(`  ${Math.min(i + DISTILL_BATCH, items.length)}/${items.length} processados`)

    if (i + DISTILL_BATCH < items.length) {
      await sleep(DELAY_MS)
    }
  }

  console.log(`\n=== Fase 1 concluída: ${distilled.length} exemplos melhorados ===`)

  // --- Phase 2: Ambiguous variants (sample of 100) ---
  console.log('\n=== Fase 2: Gerando perguntas ambíguas ===')
  const ambiguousSamples = shuffle(items).slice(0, 100)
  const ambiguousVariants: TrainingExample[] = []

  for (let i = 0; i < ambiguousSamples.length; i += VARIANT_BATCH) {
    const batch = ambiguousSamples.slice(i, i + VARIANT_BATCH)
    const variants = await generateAmbiguousVariants(batch)
    ambiguousVariants.push(...variants)
    console.log(`  ${Math.min(i + VARIANT_BATCH, ambiguousSamples.length)}/${ambiguousSamples.length} - ${ambiguousVariants.length} variantes`)

    if (i + VARIANT_BATCH < ambiguousSamples.length) {
      await sleep(DELAY_MS)
    }
  }

  console.log(`\n=== Fase 2 concluída: ${ambiguousVariants.length} variantes ambíguas ===`)

  // --- Phase 3: Multi-turn conversations (sample of 80) ---
  console.log('\n=== Fase 3: Gerando conversas multi-turn ===')
  const multiTurnSamples = shuffle(items).slice(0, 80)
  const multiTurnConversations: TrainingExample[] = []

  for (let i = 0; i < multiTurnSamples.length; i += VARIANT_BATCH) {
    const batch = multiTurnSamples.slice(i, i + VARIANT_BATCH)
    const conversations = await generateMultiTurn(batch)
    multiTurnConversations.push(...conversations)
    console.log(`  ${Math.min(i + VARIANT_BATCH, multiTurnSamples.length)}/${multiTurnSamples.length} - ${multiTurnConversations.length} conversas`)

    if (i + VARIANT_BATCH < multiTurnSamples.length) {
      await sleep(DELAY_MS)
    }
  }

  console.log(`\n=== Fase 3 concluída: ${multiTurnConversations.length} multi-turn ===`)

  // --- Combine and write ---
  const allExamples = [...distilled, ...ambiguousVariants, ...multiTurnConversations]
  const outputLines = allExamples.map((ex) => JSON.stringify(ex))
  fs.writeFileSync(OUTPUT_FILE, outputLines.join('\n'), 'utf-8')

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Resumo Final:`)
  console.log(`  Exemplos distillados:      ${distilled.length}`)
  console.log(`  Variantes ambíguas:        ${ambiguousVariants.length}`)
  console.log(`  Conversas multi-turn:      ${multiTurnConversations.length}`)
  console.log(`  TOTAL DE EXEMPLOS:         ${allExamples.length}`)
  console.log(`  Arquivo gerado:            ${OUTPUT_FILE}`)
  console.log(`${'='.repeat(50)}`)
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

main().catch(console.error)
