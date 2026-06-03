import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('atendimentos')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'Não encontrado' }, { status: 404 })

  let avaliacoes: unknown[] = []
  if (data.phone && data.cnpj) {
    const { data: av } = await supabase
      .from('avaliacoes_atendimento')
      .select('*')
      .eq('phone', data.phone)
      .eq('cnpj', data.cnpj)
      .order('criado_em', { ascending: false })
      .limit(5)
    avaliacoes = av || []
  }

  return Response.json({ atendimento: data, avaliacoes })
}

/**
 * PATCH /api/atendimentos/[id]
 *
 * Atualiza campos pontuais do atendimento. Por enquanto cobre validação
 * (validado, validacao_comentario, validado_por) — o front envia o email
 * do usuário autenticado em `validado_por`. Quando `validado=true`, o
 * `validado_em` é definido no servidor (now()); quando `validado=false`,
 * ambos `validado_em` e `validado_por` são limpos.
 *
 * Body esperado:
 * {
 *   validado?: boolean,
 *   validado_por?: string,
 *   validacao_comentario?: string
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServerClient()

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}

  if (typeof body.validado === 'boolean') {
    update.validado = body.validado
    if (body.validado) {
      update.validado_em = new Date().toISOString()
      // valida_por só é setado se o front mandou (vem do auth do front)
      if (typeof body.validado_por === 'string' && body.validado_por.trim()) {
        update.validado_por = body.validado_por.trim()
      }
    } else {
      update.validado_em = null
      update.validado_por = null
    }
  }

  if ('validacao_comentario' in body) {
    update.validacao_comentario =
      typeof body.validacao_comentario === 'string'
        ? body.validacao_comentario
        : null
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'Nada a atualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('atendimentos')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'Não encontrado' }, { status: 404 })

  return Response.json({ atendimento: data })
}
