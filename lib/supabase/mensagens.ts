import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Client do banco SECUNDÁRIO, onde vivem as mensagens de conversa
// (public.mensagens). É um projeto Supabase separado do Nexus, então não dá
// pra reaproveitar `createServerClient()` — nem existe FK entre os dois.
//
// Só server-side: usa service role.
let cached: SupabaseClient | null = null

export function getMensagensClient(): SupabaseClient | null {
  if (cached) return cached

  const url = process.env.MENSAGENS_SUPABASE_URL
  const key = process.env.MENSAGENS_SUPABASE_SERVICE_ROLE_KEY

  // Sem config, devolve null pra quem chama cair no fallback da transcrição
  // em vez de estourar com um client apontando pra placeholder.
  if (!url || !key) return null

  cached = createClient(url, key, { auth: { persistSession: false } })
  return cached
}

// Só as mensagens do fluxo Nexus entram na conversa. Os outros remetentes
// (cliente, colaborador, bot, sistema, supervisor, cliente-widget) são de
// outros canais/atendimentos humanos e não fazem parte do atendimento da IA.
export const REMETENTES_NEXUS = ['cliente-nexus', 'bot-nexus'] as const

export type RemetenteNexus = (typeof REMETENTES_NEXUS)[number]

export type MensagemTipo = 'texto' | 'imagem' | 'audio' | 'video' | 'documento'

export type Mensagem = {
  id: string
  ticket_id: string | null
  cliente_id: string | null
  remetente: RemetenteNexus
  conteudo: string | null
  tipo: MensagemTipo
  enviado_em: string | null
  is_bot: boolean | null
  url_imagem: string | null
  media_type: string | null
  canal: string | null
  reply_to_message_id: string | null
}

const COLUNAS =
  'id, ticket_id, cliente_id, remetente, conteudo, tipo, enviado_em, is_bot, url_imagem, media_type, canal, reply_to_message_id'

export function onlyDigits(v: string | null | undefined): string {
  return String(v ?? '').replace(/\D/g, '')
}

// Não existe FK entre o banco do Nexus e o de mensagens, então o vínculo é
// feito pelo cliente. O telefone é a chave mais confiável, mas os formatos
// divergem (com/sem +55, com/sem o 9º dígito), então casamos pelos últimos
// 8 dígitos — que são estáveis em qualquer formato — e desempatamos pelo
// CNPJ quando mais de um cliente casa.
export async function findClienteId(input: {
  phone?: string | null
  cnpj?: string | null
}): Promise<string | null> {
  const supabase = getMensagensClient()
  if (!supabase) return null

  const cnpj = onlyDigits(input.cnpj)
  const tail = onlyDigits(input.phone).slice(-8)

  if (tail.length === 8) {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, telefone, CNPJ')
      .like('telefone', `%${tail}`)
      .limit(20)

    if (error) throw new Error(error.message)

    const rows = data ?? []
    if (rows.length === 1) return rows[0].id as string
    if (rows.length > 1) {
      const exato = cnpj
        ? rows.find((r) => onlyDigits(r.CNPJ as string) === cnpj)
        : null
      // Sem CNPJ pra desempatar, o primeiro é um chute — melhor devolver o
      // match exato ou nada do que exibir a conversa de outro cliente.
      return (exato?.id as string) ?? null
    }
  }

  if (cnpj) {
    const { data, error } = await supabase
      .from('clientes')
      .select('id')
      .eq('CNPJ', cnpj)
      .limit(2)

    if (error) throw new Error(error.message)
    if (data?.length === 1) return data[0].id as string
  }

  return null
}

// Varredura de um período inteiro, só com o mínimo pra agrupar conversas
// por cliente. Pagina de 1000 em 1000 (teto do PostgREST) até `maxRows`.
export type MensagemResumo = {
  cliente_id: string
  remetente: string
  enviado_em: string
}

export async function listMensagensNoPeriodo(
  from: string,
  to: string,
  maxRows = 200_000
): Promise<{ rows: MensagemResumo[]; truncated: boolean }> {
  const supabase = getMensagensClient()
  if (!supabase) return { rows: [], truncated: false }

  const PAGINA = 1000
  const rows: MensagemResumo[] = []

  for (let offset = 0; offset < maxRows; offset += PAGINA) {
    const { data, error } = await supabase
      .from('mensagens')
      .select('cliente_id, remetente, enviado_em')
      .in('remetente', REMETENTES_NEXUS)
      .not('cliente_id', 'is', null)
      .gte('enviado_em', from)
      .lte('enviado_em', to)
      .order('enviado_em', { ascending: true })
      .range(offset, offset + PAGINA - 1)

    if (error) throw new Error(error.message)

    const lote = (data ?? []) as MensagemResumo[]
    rows.push(...lote)
    if (lote.length < PAGINA) return { rows, truncated: false }
  }

  return { rows, truncated: true }
}

// Dados de cadastro dos clientes, em lotes — um `in.()` com centenas de
// UUIDs estoura o tamanho da URL.
export type ClienteResumo = {
  id: string
  nome: string | null
  telefone: string | null
  CNPJ: string | null
  PDV: string | null
}

export async function listClientesByIds(
  ids: string[]
): Promise<Map<string, ClienteResumo>> {
  const supabase = getMensagensClient()
  const mapa = new Map<string, ClienteResumo>()
  if (!supabase || ids.length === 0) return mapa

  const LOTE = 80
  for (let i = 0; i < ids.length; i += LOTE) {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nome, telefone, CNPJ, PDV')
      .in('id', ids.slice(i, i + LOTE))

    if (error) throw new Error(error.message)
    for (const c of (data ?? []) as ClienteResumo[]) mapa.set(c.id, c)
  }

  return mapa
}

// Instantes de encerramento de ticket do cliente dentro de uma janela.
// Cada encerramento fecha um atendimento: a mensagem seguinte já pertence
// ao próximo (é o estado "Sem ticket" da conversa com a IA).
export async function listEncerramentosTicket(
  clienteId: string,
  opts: { from?: string | null; to?: string | null } = {}
): Promise<number[]> {
  const supabase = getMensagensClient()
  if (!supabase) return []

  let query = supabase
    .from('tickets')
    .select('encerrado_em')
    .eq('cliente_id', clienteId)
    .eq('status', 'encerrado')
    .not('encerrado_em', 'is', null)

  if (opts.from) query = query.gte('encerrado_em', opts.from)
  if (opts.to) query = query.lte('encerrado_em', opts.to)

  const { data, error } = await query.order('encerrado_em', { ascending: true })
  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((r) => Date.parse(r.encerrado_em as string))
    .filter((n) => Number.isFinite(n))
}

// Mensagens de um ticket, na ordem cronológica. Usa o índice
// idx_mensagens_ticket_enviado (ticket_id, enviado_em desc).
export async function listMensagensByTicket(
  ticketId: string,
  limit = 500
): Promise<Mensagem[]> {
  const supabase = getMensagensClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('mensagens')
    .select(COLUNAS)
    .eq('ticket_id', ticketId)
    .in('remetente', REMETENTES_NEXUS)
    .order('enviado_em', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as Mensagem[]
}

// Mensagens de um cliente, opcionalmente recortadas por janela de tempo —
// é o caminho usado quando o atendimento casa por cliente (telefone) e não
// por ticket.
export async function listMensagensByCliente(
  clienteId: string,
  opts: { from?: string | null; to?: string | null; limit?: number } = {}
): Promise<Mensagem[]> {
  const supabase = getMensagensClient()
  if (!supabase) return []

  let query = supabase
    .from('mensagens')
    .select(COLUNAS)
    .eq('cliente_id', clienteId)
    .in('remetente', REMETENTES_NEXUS)

  if (opts.from) query = query.gte('enviado_em', opts.from)
  if (opts.to) query = query.lte('enviado_em', opts.to)

  const { data, error } = await query
    .order('enviado_em', { ascending: true })
    .limit(opts.limit ?? 500)

  if (error) throw new Error(error.message)
  return (data ?? []) as Mensagem[]
}
