/**
 * Script para fazer fine-tuning de um modelo OpenAI com os dados exportados.
 *
 * Uso:
 *   npx tsx scripts/fine-tune.ts
 *   npx tsx scripts/fine-tune.ts --epochs=3
 *   npx tsx scripts/fine-tune.ts --suffix=nexus-v1
 *
 * Pré-requisito: ter gerado data/training.jsonl com export-training-data.ts
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
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const args = process.argv.slice(2)
const epochsArg = args.find((a) => a.startsWith('--epochs='))?.split('=')[1]
const suffixArg = args.find((a) => a.startsWith('--suffix='))?.split('=')[1] || 'nexus'

const BASE_MODEL = 'gpt-4o-mini-2024-07-18'
const TRAINING_FILE = path.resolve(process.cwd(), 'data/training.jsonl')

// ---------------------------------------------------------------------------
// 3. Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Nexus - Fine-Tuning OpenAI ===\n')

  // Verificar arquivo de treino
  if (!fs.existsSync(TRAINING_FILE)) {
    console.error(`Arquivo de treino não encontrado: ${TRAINING_FILE}`)
    console.error('Execute primeiro: npx tsx scripts/export-training-data.ts')
    process.exit(1)
  }

  const lines = fs.readFileSync(TRAINING_FILE, 'utf-8').trim().split('\n')
  console.log(`Arquivo de treino: ${TRAINING_FILE}`)
  console.log(`Exemplos de treino: ${lines.length}`)
  console.log(`Modelo base: ${BASE_MODEL}`)
  console.log(`Suffix: ${suffixArg}`)
  if (epochsArg) console.log(`Epochs: ${epochsArg}`)
  console.log('')

  if (lines.length < 10) {
    console.error('Mínimo de 10 exemplos necessários para fine-tuning.')
    process.exit(1)
  }

  // 1. Upload do arquivo
  console.log('1/3 - Fazendo upload do arquivo de treino...')
  const file = await openai.files.create({
    file: fs.createReadStream(TRAINING_FILE),
    purpose: 'fine-tune',
  })
  console.log(`     Upload concluído. File ID: ${file.id}\n`)

  // 2. Criar job de fine-tuning
  console.log('2/3 - Iniciando fine-tuning...')
  const jobParams: OpenAI.FineTuning.JobCreateParams = {
    training_file: file.id,
    model: BASE_MODEL,
    suffix: suffixArg,
  }

  if (epochsArg) {
    jobParams.hyperparameters = {
      n_epochs: parseInt(epochsArg, 10),
    }
  }

  const job = await openai.fineTuning.jobs.create(jobParams)
  console.log(`     Job criado. ID: ${job.id}`)
  console.log(`     Status: ${job.status}\n`)

  // 3. Aguardar conclusão
  console.log('3/3 - Aguardando conclusão...')
  console.log('     (Isso pode levar de 15 a 60 minutos)\n')

  let currentJob = job
  while (!['succeeded', 'failed', 'cancelled'].includes(currentJob.status)) {
    await sleep(30000) // 30 segundos

    currentJob = await openai.fineTuning.jobs.retrieve(job.id)
    const now = new Date().toLocaleTimeString('pt-BR')
    console.log(`     [${now}] Status: ${currentJob.status}`)
  }

  console.log('')

  if (currentJob.status === 'succeeded') {
    const modelId = currentJob.fine_tuned_model
    console.log('=== Fine-tuning concluído com sucesso! ===\n')
    console.log(`Modelo: ${modelId}\n`)
    console.log('Próximos passos:')
    console.log('1. Adicione ao .env.local:')
    console.log(`   NEXT_PUBLIC_OPENAI_FINETUNED_MODEL=${modelId}\n`)
    console.log('2. Reinicie o servidor Next.js')
    console.log('3. O modelo "Nexus AI" aparecerá no seletor do chat')
  } else {
    console.error(`=== Fine-tuning falhou: ${currentJob.status} ===\n`)

    // Buscar eventos de erro
    const events = await openai.fineTuning.jobs.listEvents(job.id, { limit: 10 })
    for (const event of events.data) {
      if (event.level === 'error') {
        console.error(`  Erro: ${event.message}`)
      }
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch(console.error)
