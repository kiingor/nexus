export const TRANSFER_DEDUP_WINDOW_MS = 5 * 60 * 1000

export type AtendimentoDedupRow = {
  id: number | string
  status: string | null
  criado_em?: string | null
  data_hora_chegada?: string | null
  hub_cliente_id?: string | null
  cnpj?: string | null
  phone?: string | null
  whatsapp_contato?: string | null
}

function onlyDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '')
}

function clientAliases(row: AtendimentoDedupRow): string[] {
  const aliases: string[] = []
  const hubClienteId = String(row.hub_cliente_id ?? '').trim()
  if (hubClienteId) aliases.push(`hub:${hubClienteId}`)

  const cnpj = onlyDigits(row.cnpj)
  if (cnpj.length >= 11) aliases.push(`cnpj:${cnpj}`)

  const phone = onlyDigits(row.phone || row.whatsapp_contato)
  if (phone.length >= 8) aliases.push(`phone:${phone}`)

  return aliases
}

function eventTime(row: AtendimentoDedupRow): number | null {
  // criado_em representa o instante em que o resultado foi gravado. Ele é
  // mais confiável para reconhecer dois INSERTs consecutivos do mesmo
  // handoff; data_hora_chegada pode apontar para o início inteiro da conversa.
  const raw = row.criado_em || row.data_hora_chegada
  if (!raw) return null
  const timestamp = Date.parse(raw)
  return Number.isFinite(timestamp) ? timestamp : null
}

/**
 * Oculta apenas transferências consecutivas do mesmo cliente dentro da
 * janela configurada. Qualquer status diferente interrompe a sequência.
 *
 * Assim, `transferida -> transferida` em poucos minutos conta uma vez, mas
 * `resolvida_ia -> transferida` e `transferida -> resolvida_ia` continuam
 * como atendimentos independentes. Os registros no banco não são alterados.
 */
export function dedupeConsecutiveTransfers<T extends AtendimentoDedupRow>(
  rows: T[],
  windowMs = TRANSFER_DEDUP_WINDOW_MS
): T[] {
  const parent = rows.map((_, index) => index)
  const aliasOwner = new Map<string, number>()
  const unidentifiable: T[] = []

  const find = (index: number): number => {
    let root = index
    while (parent[root] !== root) root = parent[root]
    while (parent[index] !== index) {
      const next = parent[index]
      parent[index] = root
      index = next
    }
    return root
  }

  const union = (left: number, right: number) => {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot
  }

  rows.forEach((row, index) => {
    const aliases = clientAliases(row)
    if (aliases.length === 0) {
      unidentifiable.push(row)
      return
    }
    for (const alias of aliases) {
      const owner = aliasOwner.get(alias)
      if (owner === undefined) aliasOwner.set(alias, index)
      else union(index, owner)
    }
  })

  const identifiable = new Map<number, T[]>()
  rows.forEach((row, index) => {
    if (clientAliases(row).length === 0) return
    const root = find(index)
    const list = identifiable.get(root) ?? []
    list.push(row)
    identifiable.set(root, list)
  })

  const kept: T[] = [...unidentifiable]

  for (const clientRows of identifiable.values()) {
    clientRows.sort((a, b) => {
      const timeDiff = (eventTime(a) ?? 0) - (eventTime(b) ?? 0)
      if (timeDiff !== 0) return timeDiff
      return Number(a.id) - Number(b.id)
    })

    let previousEvent: T | null = null
    for (const row of clientRows) {
      const currentTime = eventTime(row)
      const previousTime = previousEvent ? eventTime(previousEvent) : null
      const duplicateTransfer =
        row.status === 'transferida' &&
        previousEvent?.status === 'transferida' &&
        currentTime !== null &&
        previousTime !== null &&
        currentTime >= previousTime &&
        currentTime - previousTime <= windowMs

      if (!duplicateTransfer) kept.push(row)
      // Mesmo quando a linha é ocultada, ela é o evento anterior da sequência.
      // Isso mantém uma cadeia contínua de transferências dentro da janela.
      previousEvent = row
    }
  }

  return kept
}
