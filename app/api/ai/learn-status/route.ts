/**
 * API para verificar status de um fine-tune job.
 *
 * GET /api/ai/learn-status?jobId=ftjob-xxx
 */

import { NextRequest } from 'next/server'
import OpenAI from 'openai'

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('jobId')
    if (!jobId) {
      return Response.json({ error: 'jobId é obrigatório' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
    const job = await openai.fineTuning.jobs.retrieve(jobId)

    // Se concluído, buscar o modelo
    let fineTunedModel: string | null = null
    if (job.status === 'succeeded') {
      fineTunedModel = job.fine_tuned_model
    }

    // Buscar eventos recentes
    const events = await openai.fineTuning.jobs.listEvents(jobId, { limit: 5 })
    const lastEvent = events.data[0]

    return Response.json({
      jobId: job.id,
      status: job.status,
      fineTunedModel,
      createdAt: job.created_at,
      completedAt: job.finished_at,
      trainedTokens: job.trained_tokens,
      lastEvent: lastEvent
        ? {
            message: lastEvent.message,
            createdAt: lastEvent.created_at,
          }
        : null,
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('Learn status error:', errMsg)
    return Response.json({ error: errMsg }, { status: 500 })
  }
}
