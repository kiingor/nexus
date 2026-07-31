import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { MonitoriaInput } from '@/lib/types'

function normalize(body: MonitoriaInput) {
  return {
    nota_avaliacao: body.nota_avaliacao ?? null,
    data_avaliacao: body.data_avaliacao ?? new Date().toISOString(),
    transcricao: body.transcricao ?? null,
    nota_cliente: body.nota_cliente ?? null,
    ramal: body.ramal ?? null,
    numero_contato: body.numero_contato ?? null,
    questionario: body.questionario ?? null,
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (
    process.env.NODE_ENV === 'development' &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
  ) {
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    return Response.json(DEMO_MONITORAMENTO.filter(item =>
      (!from || item.created_at >= from) && (!to || item.created_at <= to)
    ))
  }

  const supabase = createServerClient()

  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500)
  const atendente = searchParams.get('atendente')
  const prioridade = searchParams.get('prioridade')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('monitoramento_nexus')
    .select('*')
    .not('atendente', 'is', null)
    .neq('atendente', '')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (atendente) query = query.eq('atendente', atendente)
  if (prioridade) query = query.eq('prioridade', prioridade)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data, error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data || [])
}

const DEMO_MONITORAMENTO = [
  {
    id: 1, atendente: 'Renata Alves', normalizacao_ok: true, nota_geral: 9,
    classificacao_qualidade: 'Excelente', produto_ou_assunto: 'Liberação de sistema',
    motivo_do_contato: 'Acesso bloqueado após pagamento', motivo_identificado_corretamente_pelo_bot: 'Sim',
    avaliacao_clareza: 5, avaliacao_empatia_e_tom: 5, avaliacao_compreensao_do_contexto: 4,
    avaliacao_adequacao_dos_proximos_passos: 5, avaliacao_resolucao_ou_encaminhamento: 5,
    avaliacao_justificativa_resumida: 'Entendeu o contexto, orientou por etapas e confirmou o funcionamento antes de encerrar.',
    linguagem_inadequada_identificada: 'Não', linguagem_inadequada_tipo: null,
    linguagem_inadequada_sequencias_relacionadas: [], irritacao_nivel: 'Baixa',
    irritacao_evidencia_resumida: 'Cliente manteve tom positivo durante todo o contato.', prioridade: 'Baixa',
    riscos_e_pontos_importantes: [], proxima_acao_recomendada: 'Registrar a solução aplicada na base de conhecimento.',
    resumo_executivo: 'Demanda concluída no primeiro contato.', created_at: '2026-07-30T13:30:00-03:00',
    nome_cliente: 'Mercado Santa Clara', cnpj_cliente: '12345678000190',
  },
  {
    id: 2, atendente: 'Renata Alves', normalizacao_ok: true, nota_geral: 8,
    classificacao_qualidade: 'Bom', produto_ou_assunto: 'Configuração de PDV',
    motivo_do_contato: 'Impressora não reconhecida', motivo_identificado_corretamente_pelo_bot: 'Sim',
    avaliacao_clareza: 4, avaliacao_empatia_e_tom: 5, avaliacao_compreensao_do_contexto: 4,
    avaliacao_adequacao_dos_proximos_passos: 4, avaliacao_resolucao_ou_encaminhamento: 4,
    avaliacao_justificativa_resumida: 'Conduziu o diagnóstico com clareza e encaminhou a validação final corretamente.',
    linguagem_inadequada_identificada: 'Não', linguagem_inadequada_tipo: null,
    linguagem_inadequada_sequencias_relacionadas: [], irritacao_nivel: 'Média',
    irritacao_evidencia_resumida: 'Cliente demonstrou pressa no início do contato.', prioridade: 'Média',
    riscos_e_pontos_importantes: [], proxima_acao_recomendada: 'Confirmar estabilidade do periférico no próximo turno.',
    resumo_executivo: 'Configuração ajustada com sucesso.', created_at: '2026-07-29T16:10:00-03:00',
    nome_cliente: 'Padaria Central', cnpj_cliente: '98765432000110',
  },
  {
    id: 3, atendente: 'Márcia Brandão', normalizacao_ok: true, nota_geral: 4,
    classificacao_qualidade: 'Alerta crítico', produto_ou_assunto: 'Emissão fiscal',
    motivo_do_contato: 'Falha ao emitir NF-e', motivo_identificado_corretamente_pelo_bot: 'Parcialmente',
    avaliacao_clareza: 2, avaliacao_empatia_e_tom: 2, avaliacao_compreensao_do_contexto: 1,
    avaliacao_adequacao_dos_proximos_passos: 2, avaliacao_resolucao_ou_encaminhamento: 1,
    avaliacao_justificativa_resumida: 'Não confirmou o contexto, repetiu perguntas e transferiu sem explicar o próximo passo.',
    linguagem_inadequada_identificada: 'Não', linguagem_inadequada_tipo: null,
    linguagem_inadequada_sequencias_relacionadas: [], irritacao_nivel: 'Alta',
    irritacao_evidencia_resumida: 'Frustração e urgência cresceram ao longo da conversa.', prioridade: 'Crítica',
    riscos_e_pontos_importantes: ['Risco de churn', 'Cliente identificou respostas mecânicas'],
    proxima_acao_recomendada: 'Revisar o atendimento e contatar o cliente com uma orientação conclusiva.',
    resumo_executivo: 'Transferência sem orientação prática.', created_at: '2026-07-30T10:45:00-03:00',
    nome_cliente: 'Loja Horizonte', cnpj_cliente: '11222333000144',
  },
]

export async function POST(request: NextRequest) {
  // External calls (e.g. n8n) must send Bearer token; internal UI skips auth
  const authHeader = request.headers.get('authorization')
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const isExternalCall = !!apiKey

  if (isExternalCall && apiKey !== process.env.API_SECRET_KEY) {
    return Response.json({ error: 'API key inválida.' }, { status: 401 })
  }

  let body: MonitoriaInput | MonitoriaInput[]
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Batch insert when array is sent
  if (Array.isArray(body)) {
    if (body.length === 0) {
      return Response.json({ error: 'Array vazio.' }, { status: 400 })
    }

    const payload = body.map(normalize)
    const { data, error } = await supabase
      .from('monitoria')
      .insert(payload)
      .select()

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ count: data?.length || 0, records: data || [] }, { status: 201 })
  }

  const { data, error } = await supabase
    .from('monitoria')
    .insert(normalize(body))
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
