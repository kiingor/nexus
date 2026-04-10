/**
 * Script para exportar knowledge items como dados de treino para fine-tuning OpenAI.
 *
 * Uso:
 *   npx tsx scripts/export-training-data.ts
 *
 * Gera: data/training.jsonl
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// 1. Carregar .env.local
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('Ficheiro .env.local não encontrado!')
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
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SYSTEM_PROMPT = `Você é um assistente de suporte técnico especializado. Responda de forma objetiva, direta e precisa com base no seu conhecimento. Se não souber a resposta, diga claramente.`

// ---------------------------------------------------------------------------
// 3. Tipos
// ---------------------------------------------------------------------------
interface InstructionStep {
  passo: number
  acao: string
  orientacao: string | null
  atalho: string | null
}

interface InstructionContent {
  type: 'instruction'
  steps: InstructionStep[]
}

interface ErrorContent {
  type: 'error'
  error_code: string | null
  description: string
  cause: string
  solution: string
  orientation: string | null
}

type KnowledgeContent = InstructionContent | ErrorContent

interface KnowledgeItem {
  id: string
  title: string
  type: string
  content: KnowledgeContent
  keywords: string[]
  modules: { name: string; products: { name: string } }
}

interface TrainingMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface TrainingExample {
  messages: TrainingMessage[]
}

// ---------------------------------------------------------------------------
// 4. Formatar resposta do assistant
// ---------------------------------------------------------------------------
function formatInstructionResponse(item: KnowledgeItem, content: InstructionContent): string {
  const product = item.modules.products.name
  const module = item.modules.name

  let response = `Para ${item.title} (${product} - ${module}):\n\n`
  for (const step of content.steps) {
    response += `${step.passo}. ${step.acao}`
    if (step.orientacao) response += `\n   Orientação: ${step.orientacao}`
    if (step.atalho) response += `\n   Atalho: ${step.atalho}`
    response += '\n'
  }
  return response.trim()
}

function formatErrorResponse(item: KnowledgeItem, content: ErrorContent): string {
  const product = item.modules.products.name
  const module = item.modules.name

  let response = `Erro: ${item.title} (${product} - ${module})\n`
  if (content.error_code) response += `Código: ${content.error_code}\n`
  response += `\nDescrição: ${content.description}`
  response += `\nCausa: ${content.cause}`
  response += `\nSolução: ${content.solution}`
  if (content.orientation) response += `\nOrientação adicional: ${content.orientation}`
  return response.trim()
}

// ---------------------------------------------------------------------------
// 5. Gerar variantes de perguntas
// ---------------------------------------------------------------------------
function generateInstructionQuestions(item: KnowledgeItem): string[] {
  const product = item.modules.products.name
  const module = item.modules.name
  const questions: string[] = [
    `Como fazer ${item.title}?`,
    `Qual o procedimento para ${item.title}?`,
    `Quais são os passos para ${item.title}?`,
    `Como ${item.title} no ${product}?`,
    `Preciso de ajuda com ${item.title} no módulo ${module}.`,
  ]

  if (item.keywords?.length) {
    for (const kw of item.keywords.slice(0, 2)) {
      questions.push(`Como faço para ${kw}?`)
    }
  }

  return questions
}

function generateErrorQuestions(item: KnowledgeItem, content: ErrorContent): string[] {
  const product = item.modules.products.name
  const questions: string[] = [
    `Como resolver ${item.title}?`,
    `Estou com o problema: ${item.title}. O que fazer?`,
    `O que causa ${item.title}?`,
  ]

  if (content.error_code) {
    questions.push(`Erro ${content.error_code}, o que fazer?`)
    questions.push(`Apareceu o código ${content.error_code} no ${product}. Como resolvo?`)
  }

  if (item.keywords?.length) {
    for (const kw of item.keywords.slice(0, 2)) {
      questions.push(`Problema com ${kw}, como resolver?`)
    }
  }

  return questions
}

// ---------------------------------------------------------------------------
// 6. Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Nexus - Exportador de Dados de Treino ===\n')

  const { data: items, error } = await supabase
    .from('knowledge_items')
    .select('*, modules(name, products(name))')
    .eq('is_active', true)

  if (error) {
    console.error('Erro ao buscar itens:', error.message)
    process.exit(1)
  }

  if (!items || items.length === 0) {
    console.log('Nenhum item ativo encontrado.')
    return
  }

  console.log(`Encontrados ${items.length} itens ativos.\n`)

  const examples: TrainingExample[] = []

  for (const item of items as KnowledgeItem[]) {
    let questions: string[]
    let assistantResponse: string

    if (item.content.type === 'instruction') {
      const content = item.content as InstructionContent
      questions = generateInstructionQuestions(item)
      assistantResponse = formatInstructionResponse(item, content)
    } else {
      const content = item.content as ErrorContent
      questions = generateErrorQuestions(item, content)
      assistantResponse = formatErrorResponse(item, content)
    }

    for (const question of questions) {
      examples.push({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: question },
          { role: 'assistant', content: assistantResponse },
        ],
      })
    }

    console.log(`  ${item.title} → ${questions.length} exemplos`)
  }

  // Criar diretório data/ se não existir
  const outputDir = path.resolve(process.cwd(), 'data')
  fs.mkdirSync(outputDir, { recursive: true })

  // Escrever JSONL
  const outputPath = path.join(outputDir, 'training.jsonl')
  const lines = examples.map((ex) => JSON.stringify(ex))
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8')

  console.log(`\n=== Resumo ===`)
  console.log(`Itens processados:    ${items.length}`)
  console.log(`Exemplos de treino:   ${examples.length}`)
  console.log(`Arquivo gerado:       ${outputPath}`)
  console.log(`\nPróximo passo: npx tsx scripts/fine-tune.ts`)
}

main().catch(console.error)
