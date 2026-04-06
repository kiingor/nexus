/**
 * Script para gerar embeddings de todos os knowledge_items existentes.
 *
 * Uso:
 *   npx tsx scripts/generate-embeddings.ts
 *
 * Variáveis de ambiente necessárias (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 *   GEMINI_API_KEY
 *
 * Flags opcionais:
 *   --provider=openai     Gerar só OpenAI
 *   --provider=gemini     Gerar só Gemini
 *   --provider=all        Gerar ambos (default)
 *   --force               Regerar embeddings mesmo que já existam
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
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
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const OPENAI_KEY = process.env.OPENAI_API_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY

const args = process.argv.slice(2)
const providerArg = args.find(a => a.startsWith('--provider='))?.split('=')[1] || 'all'
const forceRegenerate = args.includes('--force')

const useOpenAI = providerArg === 'all' || providerArg === 'openai'
const useGemini = providerArg === 'all' || providerArg === 'gemini'

if (useOpenAI && !OPENAI_KEY) {
  console.error('OPENAI_API_KEY não configurada no .env.local')
  process.exit(1)
}
if (useGemini && !GEMINI_KEY) {
  console.error('GEMINI_API_KEY não configurada no .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const openai = useOpenAI ? new OpenAI({ apiKey: OPENAI_KEY }) : null
const genai = useGemini ? new GoogleGenerativeAI(GEMINI_KEY!) : null

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
  module_id: string
  title: string
  type: string
  content: KnowledgeContent
  keywords: string[]
  is_active: boolean
  modules: { name: string; products: { name: string } }
}

interface Chunk {
  item_id: string
  chunk_type: 'item_full' | 'step' | 'error_full'
  step_number: number | null
  chunk_text: string
}

// ---------------------------------------------------------------------------
// 4. Gerar chunks de texto a partir dos itens
// ---------------------------------------------------------------------------
function buildChunks(item: KnowledgeItem): Chunk[] {
  const chunks: Chunk[] = []
  const product = item.modules.products.name
  const module = item.modules.name
  const keywords = item.keywords?.length ? `Keywords: ${item.keywords.join(', ')}` : ''

  if (item.content.type === 'instruction') {
    const content = item.content as InstructionContent

    // Chunk do item completo
    const stepsText = content.steps
      .map(s => {
        let text = `Passo ${s.passo}: ${s.acao}`
        if (s.orientacao) text += ` | Orientação: ${s.orientacao}`
        if (s.atalho) text += ` | Atalho: ${s.atalho}`
        return text
      })
      .join('\n')

    chunks.push({
      item_id: item.id,
      chunk_type: 'item_full',
      step_number: null,
      chunk_text: `Produto: ${product}\nMódulo: ${module}\nInstrução: ${item.title}\n${keywords}\n\n${stepsText}`.trim(),
    })

    // Chunk individual por step
    for (const step of content.steps) {
      let text = `Produto: ${product} | Módulo: ${module} | Instrução: ${item.title}\n`
      text += `Passo ${step.passo}: ${step.acao}`
      if (step.orientacao) text += `\nOrientação: ${step.orientacao}`
      if (step.atalho) text += `\nAtalho: ${step.atalho}`

      chunks.push({
        item_id: item.id,
        chunk_type: 'step',
        step_number: step.passo,
        chunk_text: text.trim(),
      })
    }
  } else if (item.content.type === 'error') {
    const content = item.content as ErrorContent

    let text = `Produto: ${product}\nMódulo: ${module}\nErro: ${item.title}\n${keywords}`
    if (content.error_code) text += `\nCódigo: ${content.error_code}`
    text += `\nDescrição: ${content.description}`
    text += `\nCausa: ${content.cause}`
    text += `\nSolução: ${content.solution}`
    if (content.orientation) text += `\nOrientação: ${content.orientation}`

    chunks.push({
      item_id: item.id,
      chunk_type: 'error_full',
      step_number: null,
      chunk_text: text.trim(),
    })
  }

  return chunks
}

// ---------------------------------------------------------------------------
// 5. Gerar embeddings
// ---------------------------------------------------------------------------
async function getOpenAIEmbedding(text: string): Promise<number[]> {
  const res = await openai!.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return res.data[0].embedding
}

async function getGeminiEmbedding(text: string): Promise<number[]> {
  const model = genai!.getGenerativeModel({ model: 'gemini-embedding-001' })
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    outputDimensionality: 768,
  } as Parameters<typeof model.embedContent>[0])
  return result.embedding.values
}

// ---------------------------------------------------------------------------
// 6. Processar tudo
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Nexus - Gerador de Embeddings ===')
  console.log(`Provider: ${providerArg}`)
  console.log(`Forçar regeneração: ${forceRegenerate}`)
  console.log('')

  // Buscar todos os itens ativos com info do módulo e produto
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

  console.log(`Encontrados ${items.length} itens ativos.`)

  // Se --force, limpar embeddings existentes
  if (forceRegenerate) {
    console.log('A limpar embeddings existentes...')
    await supabase.from('knowledge_embeddings').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    console.log('Limpo!')
  }

  let totalChunks = 0
  let processed = 0
  let skipped = 0
  let errors = 0

  for (const item of items as KnowledgeItem[]) {
    const chunks = buildChunks(item)
    totalChunks += chunks.length

    for (const chunk of chunks) {
      try {
        // Verificar se já existe
        if (!forceRegenerate) {
          const { data: existing } = await supabase
            .from('knowledge_embeddings')
            .select('id, embedding_openai, embedding_gemini')
            .eq('item_id', chunk.item_id)
            .eq('chunk_type', chunk.chunk_type)
            .eq('step_number', chunk.step_number ?? -1)
            .maybeSingle()

          // Se já tem os embeddings pedidos, skip
          if (existing) {
            const hasOpenAI = !useOpenAI || existing.embedding_openai
            const hasGemini = !useGemini || existing.embedding_gemini
            if (hasOpenAI && hasGemini) {
              skipped++
              continue
            }
          }
        }

        // Gerar embeddings (cada provider independente)
        let embeddingOpenAI: number[] | null = null
        let embeddingGemini: number[] | null = null

        if (useOpenAI) {
          try {
            embeddingOpenAI = await getOpenAIEmbedding(chunk.chunk_text)
          } catch (err: any) {
            console.error(`    OpenAI falhou: ${err.message}`)
          }
        }
        if (useGemini) {
          try {
            embeddingGemini = await getGeminiEmbedding(chunk.chunk_text)
          } catch (err: any) {
            console.error(`    Gemini falhou: ${err.message}`)
          }
        }

        // Se nenhum provider gerou embedding, skip
        if (!embeddingOpenAI && !embeddingGemini) {
          errors++
          continue
        }

        // Inserir na tabela
        const { error: upsertError } = await supabase
          .from('knowledge_embeddings')
          .insert({
            item_id: chunk.item_id,
            chunk_type: chunk.chunk_type,
            step_number: chunk.step_number,
            chunk_text: chunk.chunk_text,
            ...(embeddingOpenAI && { embedding_openai: JSON.stringify(embeddingOpenAI) }),
            ...(embeddingGemini && { embedding_gemini: JSON.stringify(embeddingGemini) }),
          })

        if (upsertError) {
          console.error(`  Erro ao guardar chunk "${chunk.chunk_type}" do item "${item.title}":`, upsertError.message)
          errors++
        } else {
          processed++
          console.log(`  [${processed}] ${item.title} → ${chunk.chunk_type}${chunk.step_number ? ` #${chunk.step_number}` : ''} ✓`)
        }

        // Rate limiting (para não exceder limites da API)
        await sleep(200)
      } catch (err: any) {
        console.error(`  Erro no chunk "${chunk.chunk_type}" do item "${item.title}":`, err.message)
        errors++
      }
    }
  }

  console.log('')
  console.log('=== Resumo ===')
  console.log(`Total de chunks: ${totalChunks}`)
  console.log(`Processados:     ${processed}`)
  console.log(`Já existentes:   ${skipped}`)
  console.log(`Erros:           ${errors}`)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(console.error)
