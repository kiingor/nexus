import assert from 'node:assert/strict'
import test from 'node:test'
import { dedupeConsecutiveTransfers } from './atendimento-dedup'

type Row = {
  id: number
  status: string
  criado_em: string
  hub_cliente_id: string
}

const row = (id: number, status: string, minute: number): Row => ({
  id,
  status,
  criado_em: `2026-08-13T12:${String(minute).padStart(2, '0')}:00.000Z`,
  hub_cliente_id: 'cliente-1',
})

test('duas transferências consecutivas em menos de cinco minutos contam uma vez', () => {
  const result = dedupeConsecutiveTransfers([row(1, 'transferida', 0), row(2, 'transferida', 2)])
  assert.deepEqual(result.map((item) => item.id), [1])
})

test('resolução e transferência permanecem separadas', () => {
  const result = dedupeConsecutiveTransfers([
    row(1, 'resolvida_ia', 0),
    row(2, 'transferida', 1),
  ])
  assert.deepEqual(result.map((item) => item.id).sort(), [1, 2])
})

test('uma resolução interrompe a sequência de transferências', () => {
  const result = dedupeConsecutiveTransfers([
    row(1, 'transferida', 0),
    row(2, 'resolvida_ia', 1),
    row(3, 'transferida', 2),
  ])
  assert.deepEqual(result.map((item) => item.id).sort(), [1, 2, 3])
})

test('transferências fora da janela permanecem separadas', () => {
  const result = dedupeConsecutiveTransfers([row(1, 'transferida', 0), row(2, 'transferida', 6)])
  assert.deepEqual(result.map((item) => item.id).sort(), [1, 2])
})

test('identificadores alternativos ligam registros do mesmo cliente', () => {
  const first = { ...row(1, 'transferida', 0), cnpj: '12.345.678/0001-90' }
  const second = {
    ...row(2, 'transferida', 1),
    hub_cliente_id: '',
    cnpj: '12345678000190',
  }
  const result = dedupeConsecutiveTransfers([first, second])
  assert.deepEqual(result.map((item) => item.id), [1])
})
