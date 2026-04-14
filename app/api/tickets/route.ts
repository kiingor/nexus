import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Parse Brazilian date "14/04/2026, 10:44:50" → ISO
function parseBRDate(s: string | null | undefined): string | null {
  if (!s) return null
  try {
    const [datePart, timePart] = s.split(', ')
    const [day, month, year] = datePart.split('/')
    return new Date(`${year}-${month}-${day}T${timePart}-03:00`).toISOString()
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const { searchParams } = new URL(request.url)

  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const status = searchParams.get('status')
  const canal = searchParams.get('canal')
  const search = searchParams.get('search')
  const from = (page - 1) * limit

  let query = supabase
    .from('support_tickets')
    .select('*', { count: 'exact' })
    .order('criado_em', { ascending: false })
    .range(from, from + limit - 1)

  if (status) query = query.eq('ticket_status', status)
  if (canal) query = query.eq('ticket_canal', canal)
  if (search) {
    query = query.or(
      `cliente_nome.ilike.%${search}%,cliente_cnpj.ilike.%${search}%,atendente.ilike.%${search}%`
    )
  }

  const { data, error, count } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ data, total: count, page, limit })
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient()
  const body = await request.json()

  const tickets = Array.isArray(body) ? body : [body]

  const rows = tickets.map((t) => ({
    ticket_id: t.ticket_id,
    ticket_numero: t.ticket_numero ?? null,
    ticket_status: t.ticket_status ?? null,
    ticket_canal: t.ticket_canal ?? null,
    ticket_prioridade: t.ticket_prioridade ?? null,
    setor: t.setor ?? null,
    atendente: t.atendente ?? null,
    suporte_id: t.suporte_id ? String(t.suporte_id) : null,
    criado_em: parseBRDate(t.criado_em),
    primeira_resposta: parseBRDate(t.primeira_resposta),
    encerrado_em: parseBRDate(t.encerrado_em),
    cliente_id: t.cliente_id ?? null,
    cliente_nome: t.cliente_nome ?? null,
    cliente_telefone: t.cliente_telefone ? String(t.cliente_telefone) : null,
    cliente_email: t.cliente_email ?? null,
    cliente_cnpj: t.cliente_cnpj ? String(t.cliente_cnpj) : null,
    cliente_pdv: t.cliente_pdv ?? null,
    duracao_total: t.duracao_total ?? null,
    tempo_primeira_resposta: t.tempo_primeira_resposta ?? null,
    total_mensagens: t.total_mensagens ?? 0,
    mensagens_cliente: t.mensagens_cliente ?? 0,
    mensagens_colaborador: t.mensagens_colaborador ?? 0,
    has_audio: t.has_audio ?? false,
    total_audios: t.total_audios ?? 0,
    has_imagem: t.has_imagem ?? false,
    total_imagens: t.total_imagens ?? 0,
    chat_history: t.chatHistory ?? null,
    raw_data: t,
  }))

  const { data, error } = await supabase
    .from('support_tickets')
    .upsert(rows, { onConflict: 'ticket_id' })
    .select('id, ticket_id, ticket_numero')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ imported: data?.length ?? 0, tickets: data }, { status: 201 })
}
