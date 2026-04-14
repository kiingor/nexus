/**
 * API para iniciar o processo de aprendizagem (gerar dataset + fine-tune).
 *
 * POST /api/ai/learn
 *   - Busca knowledge items do Supabase
 *   - Gera dataset com variações programáticas
 *   - Faz upload para OpenAI
 *   - Inicia fine-tune job
 *   - Retorna jobId para polling
 *
 * GET /api/ai/learn?status=xxx
 *   - Retorna status do fine-tune job
 */

import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createServerClient } from '@/lib/supabase/server'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Tipos
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

interface KnowledgeItem {
  id: string
  title: string
  type: string
  content: InstructionContent | ErrorContent
  keywords: string[]
  modules: { name: string; products: { name: string } }
}

const SYSTEM_PROMPT = `Você é um assistente técnico especializado nos sistemas Softcom. Existem 2 produtos principais:
1. **Softshop** — sistema de gestão comercial (retaguarda) com módulos internos (Cadastros, Vendas, Compras, Orçamento, Notas Fiscais, Utilitários, Ajustes de Estoque). Além disso, possui módulos que precisam ser instalados separadamente: Emissor, Sped, PDV, TEF e SoftcomChef.
2. **Softcomshop** — sistema de gestão comercial online com módulos internos (Compras e Estoque, Configurações, Relatórios, Vendas e NFe). Também utiliza os módulos instalados separadamente: PDV, TEF e SoftcomChef.

Os módulos PDV, TEF e SoftcomChef são compartilhados entre Softshop e Softcomshop e precisam ser instalados à parte. O Emissor e o Sped são módulos exclusivos do Softshop, também instalados separadamente.

Sempre identifique corretamente a qual produto e módulo a instrução se refere. Se o usuário não especificar qual produto usa, pergunte antes de responder. Responda de forma clara e objetiva com o passo a passo. Se uma funcionalidade não existe em determinado produto, informe isso claramente.`

// ---------------------------------------------------------------------------
// Gerador de dataset programático
// ---------------------------------------------------------------------------
function formatInstructionResponse(item: KnowledgeItem, content: InstructionContent): string {
  const product = item.modules.products.name
  const module = item.modules.name
  let response = `**Produto:** ${product}\n**Módulo:** ${module} (módulo interno do ${product})\n\n`

  for (const step of content.steps) {
    response += `${step.passo}. ${step.acao}`
    if (step.orientacao) response += `\n   *Orientação:* ${step.orientacao}`
    if (step.atalho) response += `\n   *Atalho:* ${step.atalho}`
    response += '\n'
  }
  return response.trim()
}

function formatErrorResponse(item: KnowledgeItem, content: ErrorContent): string {
  const product = item.modules.products.name
  const module = item.modules.name
  let response = `**Produto:** ${product}\n**Módulo:** ${module}\n\n`
  response += `**Erro:** ${item.title}\n`
  if (content.error_code) response += `**Código:** ${content.error_code}\n`
  response += `\n**Descrição:** ${content.description}`
  response += `\n**Causa:** ${content.cause}`
  response += `\n**Solução:** ${content.solution}`
  if (content.orientation) response += `\n**Orientação:** ${content.orientation}`
  return response.trim()
}

function generateQuestions(item: KnowledgeItem): string[] {
  const product = item.modules.products.name
  const questions: string[] = [
    `Como fazer ${item.title}?`,
    `Qual o procedimento para ${item.title}?`,
    `Como ${item.title} no ${product}?`,
    `Preciso de ajuda com ${item.title} no módulo ${item.modules.name}.`,
  ]

  if (item.keywords?.length) {
    for (const kw of item.keywords.slice(0, 3)) {
      questions.push(`Como faço para ${kw}?`)
    }
  }

  // Adicionar variações casuais
  questions.push(`me explica como ${item.title}`)
  questions.push(`${item.title}, como funciona?`)

  return questions
}

function generateAmbiguousQuestions(item: KnowledgeItem): string[] {
  const questions: string[] = [
    `Como fazer ${item.title}?`,
    `Como ${item.title}?`,
    `me ajuda com ${item.title}`,
  ]
  return questions
}

function generateErrorResponse(item: KnowledgeItem, content: ErrorContent): string {
  return formatErrorResponse(item, content)
}

// ---------------------------------------------------------------------------
// Build dataset
// ---------------------------------------------------------------------------
function buildDataset(items: KnowledgeItem[]): { examples: number; jsonl: string } {
  const examples: Array<{ messages: Array<{ role: string; content: string }> }> = []

  for (const item of items) {
    if (item.content.type === 'instruction') {
      const content = item.content as InstructionContent
      const response = formatInstructionResponse(item, content)
      const questions = generateQuestions(item)

      for (const question of questions) {
        examples.push({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: question },
            { role: 'assistant', content: response },
          ],
        })
      }

      // Ambiguous variants (without product specification)
      const ambiguousQuestions = generateAmbiguousQuestions(item)
      for (const question of ambiguousQuestions) {
        examples.push({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: question },
            { role: 'assistant', content: response },
          ],
        })
      }
    } else {
      const content = item.content as ErrorContent
      const response = generateErrorResponse(item, content)
      const questions = [
        `Como resolver ${item.title}?`,
        `Estou com o problema: ${item.title}. O que fazer?`,
        `O que causa ${item.title}?`,
        `Erro no ${item.modules.products.name}: ${item.title}`,
      ]
      if (content.error_code) {
        questions.push(`Erro ${content.error_code}, o que fazer?`)
      }
      if (item.keywords?.length) {
        for (const kw of item.keywords.slice(0, 2)) {
          questions.push(`Problema com ${kw}, como resolver?`)
        }
      }

      for (const question of questions) {
        examples.push({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: question },
            { role: 'assistant', content: response },
          ],
        })
      }
    }
  }

  const jsonl = examples.map((ex) => JSON.stringify(ex)).join('\n')
  return { examples: examples.length, jsonl }
}

// ---------------------------------------------------------------------------
// POST /api/ai/learn
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
    const supabase = createServerClient()

    console.log('[Learn] Iniciando processo de aprendizagem...')

    // 1. Fetch knowledge items
    console.log('[Learn] Buscando knowledge items do Supabase...')
    const { data: items, error } = await supabase
      .from('knowledge_items')
      .select('*, modules(name, products(name))')
      .eq('is_active', true)

    if (error) {
      console.error('[Learn] Erro Supabase:', error.message)
      return Response.json({ error: `Erro ao buscar itens: ${error.message}` }, { status: 500 })
    }

    if (!items || items.length === 0) {
      return Response.json({ error: 'Nenhum item ativo encontrado' }, { status: 400 })
    }

    console.log(`[Learn] ${items.length} itens encontrados`)

    // 2. Build dataset
    console.log('[Learn] Gerando dataset...')
    const { examples, jsonl } = buildDataset(items as KnowledgeItem[])

    if (examples < 10) {
      return Response.json({ error: 'Mínimo de 10 exemplos necessário' }, { status: 400 })
    }

    console.log(`[Learn] ${examples} exemplos gerados`)

    // 3. Write temporary file
    const tmpPath = path.resolve(process.cwd(), 'data', `training-${Date.now()}.jsonl`)
    fs.mkdirSync(path.dirname(tmpPath), { recursive: true })
    fs.writeFileSync(tmpPath, jsonl, 'utf-8')

    const fileSizeKB = Math.round(Buffer.byteLength(jsonl) / 1024)
    console.log(`[Learn] Arquivo temporário criado: ${tmpPath} (${fileSizeKB}KB)`)

    // 4. Upload to OpenAI
    console.log('[Learn] Fazendo upload para OpenAI...')
    let fileId: string
    try {
      const file = await openai.files.create({
        file: fs.createReadStream(tmpPath),
        purpose: 'fine-tune',
      })
      fileId = file.id
      console.log(`[Learn] Upload concluído. File ID: ${fileId}`)
    } catch (uploadError: unknown) {
      const err = uploadError instanceof Error ? uploadError : new Error(String(uploadError))
      console.error('[Learn] Erro no upload para OpenAI:', err.message)
      // Cleanup temp file
      try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
      return Response.json(
        { error: `Erro no upload para OpenAI: ${err.message}` },
        { status: 500 }
      )
    }

    // 5. Create fine-tuning job
    console.log('[Learn] Criando fine-tuning job...')
    const suffix = `nexus-v${Date.now().toString(36)}`
    let job
    try {
      job = await openai.fineTuning.jobs.create({
        training_file: fileId,
        model: 'gpt-4o-mini-2024-07-18',
        suffix,
      })
      console.log(`[Learn] Job criado: ${job.id}`)
    } catch (jobError: unknown) {
      const err = jobError instanceof Error ? jobError : new Error(String(jobError))
      console.error('[Learn] Erro ao criar fine-tuning job:', err.message)
      return Response.json(
        { error: `Erro ao criar fine-tuning: ${err.message}` },
        { status: 500 }
      )
    }

    // Cleanup temp file
    try {
      fs.unlinkSync(tmpPath)
      console.log(`[Learn] Arquivo temporário removido`)
    } catch {
      // ignore
    }

    return Response.json({
      success: true,
      jobId: job.id,
      status: job.status,
      examples,
      items: items.length,
      fileId,
      suffix,
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('Learn API error:', errMsg)
    return Response.json({ error: `Erro ao iniciar aprendizagem: ${errMsg}` }, { status: 500 })
  }
}
