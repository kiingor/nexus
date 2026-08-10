import { classifyMotivo } from '@/lib/atendimentos'
import { motivoCanonico, TIPO_ATENDIMENTO_LABELS } from '@/lib/tipos-atendimento'

export type EfetividadeSourceRow = {
  id: number
  status: string | null
  destino: string | null
  cnpj: string | null
  nome_empresa: string | null
  cliente_nome: string | null
  phone: string | null
  whatsapp_contato: string | null
  problema_relatado: string | null
  solucao_aplicada: string | null
  data_hora_chegada: string | null
  criado_em: string | null
  tipo_atendimento: string | null
  hub_cliente_id?: string | null
  tipo_contato?: string | null
  sentimento_cliente?: string | null
  pdv?: string | null
  problema_extraido?: unknown
  validado?: boolean | null
  validacao_transf?: string | null
  id_ligacao?: string | null
  transcricao?: string | null
}

export type EfetividadeFiltros = {
  from?: string | null
  to?: string | null
  retornoStatus?: string | null
  retornoDestino?: string | null
  tipoContato?: string | null
  sentimento?: string | null
  pdv?: string | null
  tipoAtendimento?: string | null
  comProblema?: boolean
  validados?: boolean
  search?: string | null
  mesmoMotivo?: boolean
}

export type EfetividadeCaso = {
  clienteKey: string
  clienteNome: string
  identificador: string
  cnpj: string | null
  telefone: string | null
  resolvida: {
    id: number
    data: string
    problema: string | null
    solucao: string | null
  }
  transferencia: {
    id: number
    data: string
    destino: string | null
    status: string
    problema: string | null
  }
  tempoAteRetornoSegundos: number
  ocorrenciasResolvidas: number
  retornosTransferidos: number
}

export type EfetividadeResultado = {
  kpi: {
    clientesResolvidos: number
    clientesEfetivos: number
    clientesQueRetornaram: number
    ocorrenciasResolvidas: number
    taxaEfetividade: number
    taxaRetorno: number
    medianaRetornoSegundos: number | null
  }
  casos: EfetividadeCaso[]
  porDestino: Array<{ destino: string; count: number }>
}

type DatedRow = EfetividadeSourceRow & {
  clienteKey: string
  dataIso: string
  dataMs: number
}

function onlyDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '')
}

function effectiveDate(row: EfetividadeSourceRow): string | null {
  return row.data_hora_chegada || row.criado_em || null
}

function clientIdentity(row: EfetividadeSourceRow): { key: string; label: string } | null {
  const cnpj = onlyDigits(row.cnpj)
  if (cnpj.length >= 11) return { key: `cnpj:${cnpj}`, label: cnpj }

  const hubId = String(row.hub_cliente_id ?? '').trim()
  if (hubId) return { key: `hub:${hubId}`, label: hubId }

  const phone = onlyDigits(row.phone || row.whatsapp_contato)
  if (phone.length >= 8) return { key: `phone:${phone}`, label: phone }

  return null
}

function toDatedRow(row: EfetividadeSourceRow): DatedRow | null {
  const identity = clientIdentity(row)
  const dataIso = effectiveDate(row)
  if (!identity || !dataIso) return null
  const dataMs = new Date(dataIso).getTime()
  if (!Number.isFinite(dataMs)) return null
  return { ...row, clienteKey: identity.key, dataIso, dataMs }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

function isInRange(timestamp: number, from?: string | null, to?: string | null): boolean {
  if (from) {
    const fromMs = new Date(from).getTime()
    if (Number.isFinite(fromMs) && timestamp < fromMs) return false
  }
  if (to) {
    const toMs = new Date(to).getTime()
    if (Number.isFinite(toMs) && timestamp > toMs) return false
  }
  return true
}

const SAO_PAULO_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function saoPauloDay(timestamp: number): string {
  const parts = SAO_PAULO_DAY_FORMATTER.formatToParts(new Date(timestamp))
  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const day = parts.find((part) => part.type === 'day')?.value ?? ''
  return `${year}-${month}-${day}`
}

function latestResolutionBeforeOnSameDay(
  resolutions: DatedRow[],
  transferMs: number
): DatedRow | null {
  const transferDay = saoPauloDay(transferMs)
  let match: DatedRow | null = null
  for (const row of resolutions) {
    if (row.dataMs >= transferMs) break
    if (saoPauloDay(row.dataMs) === transferDay) match = row
  }
  return match
}

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('pt-BR')
}

function matchesSentimento(value: string | null | undefined, filter: string): boolean {
  const text = normalized(value)
  if (filter === 'positivo') {
    return /positiv|satisfe|feliz|\bbom\b|[oó]timo|excelente/.test(text)
  }
  if (filter === 'negativo') {
    return /negativ|insatisfe|irrita|frustra|ruim|p[eé]ssimo|raiva/.test(text)
  }
  if (filter === 'neutro') return /neutr|\bok\b|indifer/.test(text)
  return true
}

function hasExtractedProblem(value: unknown): boolean {
  if (!value) return false
  if (typeof value === 'string') {
    try {
      return hasExtractedProblem(JSON.parse(value))
    } catch {
      return false
    }
  }
  if (typeof value !== 'object') return false
  return (value as { tem_problema_extraivel?: unknown }).tem_problema_extraivel === true
}

function matchesResolutionFilters(row: DatedRow, filters: EfetividadeFiltros): boolean {
  if (filters.tipoContato && row.tipo_contato !== filters.tipoContato) return false
  if (filters.pdv && row.pdv !== filters.pdv) return false
  if (filters.tipoAtendimento && row.tipo_atendimento !== filters.tipoAtendimento) return false
  if (filters.sentimento && !matchesSentimento(row.sentimento_cliente, filters.sentimento)) {
    return false
  }
  if (filters.comProblema && !hasExtractedProblem(row.problema_extraido)) return false
  if (filters.validados && row.validado !== true && !String(row.validacao_transf ?? '').trim()) {
    return false
  }

  const term = normalized(filters.search)
  if (!term) return true
  const haystack = normalized(
    [
      row.id,
      row.id_ligacao,
      row.nome_empresa,
      row.cliente_nome,
      row.cnpj,
      row.phone,
      row.whatsapp_contato,
      row.problema_relatado,
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(' ')
  )
  const digits = term.replace(/\D/g, '')
  return haystack.includes(term) || (digits.length >= 4 && onlyDigits(haystack).includes(digits))
}

function matchesReturnFilters(row: DatedRow, filters: EfetividadeFiltros): boolean {
  if (filters.retornoStatus && row.status !== filters.retornoStatus) return false
  if (filters.retornoDestino && row.destino !== filters.retornoDestino) return false
  return true
}

function motivoKey(row: DatedRow): string | null {
  const tipo = String(row.tipo_atendimento ?? '').trim()
  if (tipo) {
    const label = TIPO_ATENDIMENTO_LABELS[tipo] ?? tipo
    return normalized(motivoCanonico(label))
  }

  const fallback = motivoCanonico(
    classifyMotivo({
      problema_relatado: row.problema_relatado,
      transcricao: row.transcricao ?? null,
      problema_extraido: row.problema_extraido as Parameters<typeof classifyMotivo>[0]['problema_extraido'],
    })
  )
  return fallback === 'Suporte geral' ? null : normalized(fallback)
}

function hasSameMotive(resolution: DatedRow, transfer: DatedRow): boolean {
  const resolutionMotive = motivoKey(resolution)
  const transferMotive = motivoKey(transfer)
  return resolutionMotive !== null && resolutionMotive === transferMotive
}

/**
 * Mede a efetividade por cliente.
 *
 * O período e os filtros restringem a ocorrência `resolvida_ia`. Uma
 * transferência só conta como retorno quando acontece depois da resolução
 * e no mesmo dia civil de America/Sao_Paulo.
 */
export function calcularEfetividade(
  rows: EfetividadeSourceRow[],
  filters: EfetividadeFiltros = {}
): EfetividadeResultado {
  const datedRows = rows
    .map(toDatedRow)
    .filter((row): row is DatedRow => row !== null)
    .sort((a, b) => a.dataMs - b.dataMs || a.id - b.id)

  const resolutionsByClient = new Map<string, DatedRow[]>()
  const transfersByClient = new Map<string, DatedRow[]>()

  for (const row of datedRows) {
    if (
      row.status === 'resolvida_ia' &&
      isInRange(row.dataMs, filters.from, filters.to) &&
      matchesResolutionFilters(row, filters)
    ) {
      const list = resolutionsByClient.get(row.clienteKey) ?? []
      list.push(row)
      resolutionsByClient.set(row.clienteKey, list)
    } else if (row.status === 'transferida' || row.status === 'resolvido_parcialmente') {
      const list = transfersByClient.get(row.clienteKey) ?? []
      list.push(row)
      transfersByClient.set(row.clienteKey, list)
    }
  }

  const casos: EfetividadeCaso[] = []
  const destinationCounts = new Map<string, number>()
  let ocorrenciasResolvidas = 0

  for (const [clienteKey, resolutions] of resolutionsByClient) {
    ocorrenciasResolvidas += resolutions.length
    const transfers = transfersByClient.get(clienteKey) ?? []
    const pairs: Array<{ resolution: DatedRow; transfer: DatedRow }> = []

    for (const transfer of transfers) {
      if (!matchesReturnFilters(transfer, filters)) continue
      const resolution = latestResolutionBeforeOnSameDay(resolutions, transfer.dataMs)
      if (resolution && (!filters.mesmoMotivo || hasSameMotive(resolution, transfer))) {
        pairs.push({ resolution, transfer })
      }
    }

    if (pairs.length === 0) continue

    // Uma linha por cliente. Exibe o retorno mais recente e informa quantas
    // reincidências foram encontradas para aquele cliente.
    const pair = pairs[pairs.length - 1]
    const { resolution, transfer } = pair
    const identity = clientIdentity(resolution)!
    const destino = String(transfer.destino || 'sem_destino').toLowerCase()
    destinationCounts.set(destino, (destinationCounts.get(destino) ?? 0) + 1)

    casos.push({
      clienteKey,
      clienteNome:
        resolution.nome_empresa ||
        resolution.cliente_nome ||
        transfer.nome_empresa ||
        transfer.cliente_nome ||
        'Cliente sem nome',
      identificador: identity.label,
      cnpj: resolution.cnpj || transfer.cnpj || null,
      telefone:
        resolution.phone ||
        resolution.whatsapp_contato ||
        transfer.phone ||
        transfer.whatsapp_contato ||
        null,
      resolvida: {
        id: resolution.id,
        data: resolution.dataIso,
        problema: resolution.problema_relatado,
        solucao: resolution.solucao_aplicada,
      },
      transferencia: {
        id: transfer.id,
        data: transfer.dataIso,
        destino: transfer.destino,
        status: transfer.status || 'transferida',
        problema: transfer.problema_relatado,
      },
      tempoAteRetornoSegundos: Math.max(
        0,
        Math.round((transfer.dataMs - resolution.dataMs) / 1000)
      ),
      ocorrenciasResolvidas: resolutions.length,
      retornosTransferidos: pairs.length,
    })
  }

  casos.sort(
    (a, b) =>
      new Date(b.transferencia.data).getTime() - new Date(a.transferencia.data).getTime()
  )

  const clientesResolvidos = resolutionsByClient.size
  const clientesQueRetornaram = casos.length
  const clientesEfetivos = Math.max(0, clientesResolvidos - clientesQueRetornaram)
  const taxaEfetividade =
    clientesResolvidos > 0
      ? Math.round((clientesEfetivos / clientesResolvidos) * 1000) / 10
      : 0
  const taxaRetorno =
    clientesResolvidos > 0
      ? Math.round((clientesQueRetornaram / clientesResolvidos) * 1000) / 10
      : 0

  return {
    kpi: {
      clientesResolvidos,
      clientesEfetivos,
      clientesQueRetornaram,
      ocorrenciasResolvidas,
      taxaEfetividade,
      taxaRetorno,
      medianaRetornoSegundos: median(casos.map((caso) => caso.tempoAteRetornoSegundos)),
    },
    casos,
    porDestino: Array.from(destinationCounts, ([destino, count]) => ({ destino, count })).sort(
      (a, b) => b.count - a.count || a.destino.localeCompare(b.destino)
    ),
  }
}
