import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseWhisper, categoryFrequency } from '../src/lib/whisper.ts'
import { historyContext } from '../supabase/functions/_shared/category-history.ts'
import { canCategorizeOwner } from '../supabase/functions/_shared/category-auth.ts'

test('parses CLP amounts and preserves purpose in the description', () => {
  for (const input of ['15000 regalo en Paris', '$15.000 regalo en Paris', '15,000 regalo en Paris']) {
    assert.deepEqual(parseWhisper(input), { amount: 15000, detail: 'regalo en Paris' })
  }
  for (const input of ['', 'almuerzo', '-100 comida', '0 comida', '12.50 comida', '15.00 comida', '9999999999999999999']) assert.equal(parseWhisper(input), null)
  assert.deepEqual(parseWhisper('1000'), { amount: 1000, detail: null })
})

test('category chips use frequency only within the selected movement type', () => {
  const counts = categoryFrequency([{ type: 'Gasto', category_name: 'Comida' }, { type: 'Ingreso', category_name: 'Sueldo' }], 'Gasto')
  assert.equal(counts.get('Comida'), 1)
  assert.equal(counts.has('Sueldo'), false)
})

test('finds unfamiliar merchants throughout 800+ movements without sending the entire history', () => {
  const history = Array.from({ length: 845 }, (_, i) => ({ id: `tx-${i}`, detail: 'Supermercado', category_name: 'Comida', type: 'Gasto' }))
  history.push({ id: 'rapalon-1', detail: '📱 Rapalon (****1939)', category_name: 'Comida', type: 'Gasto' })
  history.push({ id: 'rapalon-2', detail: '📱 Rapalon (****1939)', category_name: 'Comida', type: 'Gasto' })
  const context = historyContext('Rapalon', 'Gasto', ['Comida'], history)
  assert.equal(context[0].category, 'Comida')
  assert.equal(context[0].occurrences, 2)
  assert.ok(context[0].detail.includes('Rapalon'))
  assert.ok(!JSON.stringify(context).includes('1939'))
  assert.ok(!JSON.stringify(context).includes('tx-'))
  assert.ok(context.length <= 24)
})

test('keeps conflicting purchases as context instead of turning Paris into a universal gift rule', () => {
  const history = [
    { id: 'old', detail: 'Paris Parque Arauco', category_name: 'Regalos', type: 'Gasto' },
    { id: 'other', detail: 'Paris Parque Arauco', category_name: 'Ropa', type: 'Gasto' },
    { id: 'current', detail: 'Paris Parque Arauco', category_name: 'Salud', type: 'Gasto' },
    { id: 'income', detail: 'Paris Parque Arauco', category_name: 'Sueldo', type: 'Ingreso' },
  ]
  const context = historyContext('Regalo en Paris', 'Gasto', ['Regalos', 'Ropa', 'Salud'], history, 'current')
  assert.deepEqual(new Set(context.map(item => item.category)), new Set(['Regalos', 'Ropa']))
})

test('Uber Eats history outranks Uber Trip for an Eats transaction', () => {
  const history = [
    ...Array.from({ length: 100 }, () => ({ detail: 'Uber Trip', category_name: 'Transporte', type: 'Gasto' })),
    { detail: 'Uber Eats', category_name: 'Comida', type: 'Gasto' },
  ]
  assert.equal(historyContext('Uber Eats', 'Gasto', ['Comida', 'Transporte'], history)[0].category, 'Comida')
})

test('importer cannot spend the provider key or read history with only an owner ID', async () => {
  let authCalls = 0
  const client = { auth: { getUser: async () => { authCalls++; return { data: { user: { id: 'alice' } }, error: null } } } } as unknown as Parameters<typeof canCategorizeOwner>[0]
  assert.equal(await canCategorizeOwner(client, null, 'alice', 'service'), false)
  assert.equal(await canCategorizeOwner(client, 'Bearer user-token', 'bob', 'service'), false)
  assert.equal(await canCategorizeOwner(client, 'Bearer user-token', 'alice', 'service'), true)
  assert.equal(await canCategorizeOwner(client, 'Bearer service', 'bob', 'service'), true)
  assert.equal(authCalls, 2)
})

test('preserves provenance and prefers a manual correction over repeated predictions for the same merchant', () => {
  const history = [
    ...Array.from({ length: 80 }, () => ({ detail: 'Rapalon', category_name: 'Comidas y panoramas', type: 'Gasto', category_source: 'jev' })),
    { detail: 'Rapalon', category_name: 'Comida diaria', type: 'Gasto', category_source: 'manual' },
    { detail: 'Jumbo', category_name: 'Supermercado', type: 'Gasto' },
  ];
  const context = historyContext('Rapalon', 'Gasto', ['Comidas y panoramas', 'Comida diaria', 'Supermercado'], history);
  assert.equal(context[0].source, 'manual');
  assert.equal(context[0].category, 'Comida diaria');
  assert.equal(context.find(row => row.detail === 'Jumbo')?.source, 'unknown');
});
