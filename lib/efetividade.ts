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

function latestResolutionBefore(resolutions: DatedRow[], transferMs: number): DatedRow | null {
  let match: DatedRow | null = null
  for (const row of resolutions) {
    if (row.dataMs >= transferMs) break
    match = row
  }
  return match
}

/**
 * Mede a efetividade por cliente.
 *
 * O período restringe a ocorrência `resolvida_ia`. Uma transferência pode
 * acontecer depois do fim do período e ainda conta como retorno, desde que
 * seja posterior a uma resolução do mesmo cliente.
 */
export function calcularEfetividade(
  rows: EfetividadeSourceRow[],
  range: { from?: string | null; to?: string | null } = {}
): EfetividadeResultado {
  const datedRows = rows
    .map(toDatedRow)
    .filter((row): row is DatedRow => row !== null)
    .sort((a, b) => a.dataMs - b.dataMs || a.id - b.id)

  const resolutionsByClient = new Map<string, DatedRow[]>()
  const transfersByClient = new Map<string, DatedRow[]>()

  for (const row of datedRows) {
    if (row.status === 'resolvida_ia' && isInRange(row.dataMs, range.from, range.to)) {
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
      const resolution = latestResolutionBefore(resolutions, transfer.dataMs)
      if (resolution) pairs.push({ resolution, transfer })
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
