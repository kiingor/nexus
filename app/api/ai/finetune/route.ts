import { NextRequest } from 'next/server'
import { getOpenAIClient } from '@/lib/openai'
import { toFile } from 'openai'

type TranscriptTurn = { role: 'agent' | 'client'; text: string }

interface SinglePayload {
  transcript: TranscriptTurn[]
  systemPrompt: string
  feedback: 'positive' | 'negative'
  feedbackNote?: string
  motivo?: string
  examples?: never
}

interface BatchPayload {
  examples: Array<{
    transcript: TranscriptTurn[]
    motivo?: string
    feedbackNote?: string
    correctionNotes?: string[]  // negative feedback notes for the same motivo
  }>
  systemPrompt: string
  feedback?: never
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SinglePayload | BatchPayload

    // Normalise: single example (legacy) or batch (new)
    let examples: Array<{ transcript: TranscriptTurn[]; motivo?: string; feedbackNote?: string; correctionNotes?: string[] }>

    if ('examples' in body && Array.isArray(body.examples)) {
      examples = body.examples
    } else {
      const single = body as SinglePayload
      if (single.feedback !== 'positive') {
        return Response.json({ skipped: true, reason: 'Negative feedback not used for fine-tuning' })
      }
      examples = [{ transcript: single.transcript, motivo: single.motivo, feedbackNote: single.feedbackNote }]
    }

    if (!examples.length) {
      return Response.json({ error: 'Nenhum exemplo fornecido' }, { status: 400 })
    }

    const ftModel = process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL ?? ''
    const baseModel = ftModel.startsWith('ft:') ? (ftModel.split(':')[1] ?? 'gpt-4o-mini') : (ftModel || 'gpt-4o-mini')

    const baseSystemPrompt = body.systemPrompt?.trim()
      || 'Você é um atendente de suporte técnico especializado. Responda com base na base de conhecimento.'

    // Build one JSONL line per example
    const lines: string[] = []

    for (const ex of examples) {
      if (!ex.transcript?.length) continue

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

      const parts = [`${baseSystemPrompt}${ex.motivo ? ` Assunto: ${ex.motivo}.` : ''}`]
      if (ex.feedbackNote?.trim()) {
        parts.push(`OBSERVAÇÃO DO AVALIADOR (o que funcionou bem): ${ex.feedbackNote.trim()}`)
      }
      if (ex.correctionNotes?.length) {
        parts.push(`OBSERVAÇÕES DO AVALIADOR (baseadas em avaliações negativas do mesmo motivo — podem ser erros a evitar ou instruções de como proceder corretamente):\n${ex.correctionNotes.map((n, i) => `${i + 1}. ${n}`).join('\n')}`)
      }
      const sys = parts.join('\n\n')

      messages.push({ role: 'system', content: sys })

      for (const turn of ex.transcript) {
        messages.push({
          role: turn.role === 'agent' ? 'assistant' : 'user',
          content: turn.text,
        })
      }

      // Must end on assistant
      if (messages[messages.length - 1].role !== 'assistant') messages.pop()
      if (messages.length < 3) continue

      lines.push(JSON.stringify({ messages }))
    }

    if (lines.length === 0) {
      return Response.json({ skipped: true, reason: 'No valid examples after filtering' })
    }

    const jsonl = lines.join('\n') + '\n'
    const openai = getOpenAIClient()

    const file = await toFile(Buffer.from(jsonl, 'utf-8'), 'simulation_feedback.jsonl', {
      type: 'application/jsonl',
    })

    const uploadedFile = await openai.files.create({ file, purpose: 'fine-tune' })

    const job = await openai.fineTuning.jobs.create({
      training_file: uploadedFile.id,
      model: baseModel,
      suffix: 'nexus-sim',
      hyperparameters: { n_epochs: examples.length >= 10 ? 3 : 1 },
    })

    return Response.json({
      ok: true,
      jobId: job.id,
      fileId: uploadedFile.id,
      status: job.status,
      examplesCount: lines.length,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Fine-tune error:', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}

// GET /api/ai/finetune — list recent fine-tuning jobs (used by the polling effect)
export async function GET() {
  try {
    const openai = getOpenAIClient()
    const jobs = await openai.fineTuning.jobs.list({ limit: 10 })
    return Response.json({ jobs: jobs.data })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return Response.json({ error: msg }, { status: 500 })
  }
}

