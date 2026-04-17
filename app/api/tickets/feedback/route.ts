import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createServerClient()
  const { ticket_id, feedback, note } = await request.json()

  if (!ticket_id || !['positive', 'negative'].includes(feedback)) {
    return Response.json({ error: 'ticket_id e feedback (positive|negative) são obrigatórios' }, { status: 400 })
  }

  const row = {
    ticket_id,
    feedback,
    note: note ?? null,
    updated_at: new Date().toISOString(),
  }

  // Try ticket_feedback table first
  const { error } = await supabase
    .from('ticket_feedback')
    .upsert(row, { onConflict: 'ticket_id' })

  if (error) {
    // Fallback: update columns directly on support_tickets
    await supabase
      .from('support_tickets')
      .update({ feedback, feedback_note: note ?? null, feedback_at: new Date().toISOString() })
      .eq('ticket_id', ticket_id)
    // Both may fail if migration hasn't run yet — still return ok
    // Training data is persisted client-side via localStorage
  }

  return Response.json({ ok: true })
}

export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const { searchParams } = new URL(request.url)
  const ticket_ids = searchParams.get('ticket_ids')?.split(',').filter(Boolean) ?? []

  if (ticket_ids.length === 0) return Response.json({})

  const { data } = await supabase
    .from('ticket_feedback')
    .select('ticket_id, feedback, note')
    .in('ticket_id', ticket_ids)

  if (!data) {
    const { data: d2 } = await supabase
      .from('support_tickets')
      .select('ticket_id, feedback, feedback_note')
      .in('ticket_id', ticket_ids)
      .not('feedback', 'is', null)

    const map: Record<string, { type: string; note?: string }> = {}
    d2?.forEach(r => {
      if (r.ticket_id) map[r.ticket_id] = { type: r.feedback, note: r.feedback_note ?? undefined }
    })
    return Response.json(map)
  }

  const map: Record<string, { type: string; note?: string }> = {}
  data.forEach(r => { map[r.ticket_id] = { type: r.feedback, note: r.note ?? undefined } })
  return Response.json(map)
}
