import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyWithJev, prepareJevRequest, parseJevDecision, type JevCategory } from '../supabase/functions/_shared/jev-categorizer.ts'

const categories: JevCategory[] = [
  { id: 'food', name: 'Restaurantes', type: 'Gasto' },
  { id: 'travel', name: 'Transporte', type: 'Gasto' },
  { id: 'salary', name: 'Sueldo', type: 'Ingreso' },
  { id: 'missing', name: 'Sin categoría', type: 'Gasto' },
]
const tx = { detail: 'Sushi para la cena', type: 'Gasto' }
const prepared = prepareJevRequest(tx, categories)
const response = (choice = 'c0', confidence = 0.95, probabilities = { c0: 0.95, c1: 0.05 }) => ({
  model: 'typesafe-ai/jev',
  answers: { category: { type: 'choice', choice, confidence, probabilities } },
  provider_metadata: { gateway: { cost: '0.00003' } },
})

test('only offers categories of the right type and excludes identifiers and unrelated fields', () => {
  const request = prepareJevRequest({ ...tx, user_id: 'private-id', amount: 100 } as typeof tx, categories)
  assert.deepEqual(Object.keys(request.payload.questions.category.criteria), ['c0', 'c1'])
  assert.deepEqual(request.payload.state.transaction, tx)
  assert.ok(!JSON.stringify(request.payload).includes('private-id'))
  assert.ok(!JSON.stringify(request.payload).includes('salary'))
  assert.deepEqual(request, prepareJevRequest(tx, [...categories].reverse()))
})

test('accepts a clear answer, mapping back to an existing category', () => {
  const result = parseJevDecision(response(), prepared.options)
  assert.equal(result.status, 'accepted')
  assert.equal(result.categoryId, 'food')
  assert.equal(result.category, 'Restaurantes')
  assert.equal(result.costUsd, 0.00003)
})

test('distinguishes a free Gateway response from missing or invalid cost', () => {
  for (const cost of ['0', 0]) {
    const raw = { ...response(), provider_metadata: { gateway: { cost } } }
    assert.equal(parseJevDecision(raw, prepared.options).costUsd, 0)
  }
  for (const cost of [undefined, null, '', ' ', false, '-1', 'invalid', Infinity]) {
    const raw = { ...response(), provider_metadata: { gateway: { cost } } }
    assert.equal(parseJevDecision(raw, prepared.options).costUsd, undefined)
  }
  assert.equal(parseJevDecision({ ...response(), provider_metadata: undefined }, prepared.options).costUsd, undefined)
})

test('selects the most likely category even with low confidence or a small margin', () => {
  for (const raw of [response('c0', 0.3), response('c0', 0.51, { c0: 0.51, c1: 0.49 })]) {
    const result = parseJevDecision(raw, prepared.options)
    assert.equal(result.status, 'accepted')
    assert.equal(result.category, 'Restaurantes')
  }
})

test('rejects hallucinated options, invalid numbers and malformed distributions', () => {
  for (const raw of [
    response('invented'),
    response('c0', Number.NaN),
    response('c0', 0.99, { c0: 1, c1: 1 }),
    response('c0', 0.99, { c0: -0.1, c1: 1.1 }),
    response('c1'),
    { answers: { category: { type: 'choice', choice: 'c0', confidence: 1, probabilities: { c0: 1 } } } },
    {},
  ]) assert.throws(() => parseJevDecision(raw, prepared.options), /invalid_response/)
})

test('does not call the provider without a key or for unsupported inputs', async () => {
  let calls = 0
  const fetcher: typeof fetch = async () => { calls++; throw new Error('unexpected call') }
  assert.equal((await classifyWithJev(tx, categories, { apiKey: '', fetcher })).reason, 'missing_api_key')
  assert.equal((await classifyWithJev({ ...tx, type: 'Rescate' }, categories, { apiKey: 'test', fetcher })).status, 'skipped')
  assert.equal((await classifyWithJev(tx, [], { apiKey: 'test', fetcher })).reason, 'no_categories')
  assert.equal((await classifyWithJev({ ...tx, detail: 'a'.repeat(1001) }, categories, { apiKey: 'test', fetcher })).status, 'skipped')
  assert.equal(calls, 0)
})

test('uses the Vercel TypeSafe API and fails closed on HTTP, JSON and network errors', async () => {
  const ok: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://ai-gateway.vercel.sh/typesafe/v1/systemone')
    assert.equal(init?.redirect, 'error')
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test')
    assert.equal(JSON.parse(init?.body as string).model, 'typesafe-ai/jev')
    assert.deepEqual(JSON.parse(init?.body as string), prepared.payload)
    return Response.json(response())
  }
  assert.equal((await classifyWithJev(tx, categories, { apiKey: 'test', fetcher: ok })).status, 'accepted')
  for (const fetcher of [
    async () => new Response('secret provider error', { status: 429 }),
    async () => new Response('invalid json'),
    async () => { throw new Error('private details') },
  ]) {
    const result = await classifyWithJev(tx, categories, { apiKey: 'test', fetcher })
    assert.equal(result.status, 'unavailable')
    assert.equal(result.category, 'Sin categoría')
    assert.ok(!JSON.stringify(result).includes('private'))
    assert.ok(!JSON.stringify(result).includes('secret'))
  }
})

test('aborts a slow provider request', async () => {
  const fetcher: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  })
  const result = await classifyWithJev(tx, categories, { apiKey: 'test', fetcher, timeoutMs: 5 })
  assert.equal(result.reason, 'timeout')
  assert.equal(result.status, 'unavailable')
})

test('only sends bounded whitelisted history context, with no opaque record fields', () => {
  const history = Array.from({ length: 40 }, () => ({ detail: 'Rapalon', category: 'Restaurantes', occurrences: 2, user_id: 'secret-owner', amount: 123, id: 'private-id' }))
  const request = prepareJevRequest(tx, categories, history)
  assert.equal(request.payload.state.history.length, 24)
  assert.deepEqual(request.payload.state.history[0], { detail: 'Rapalon', category: 'Restaurantes', occurrences: 2, source: 'unknown' })
  assert.ok(!JSON.stringify(request.payload).includes('secret-owner'))
  assert.ok(!JSON.stringify(request.payload).includes('private-id'))
  assert.equal(prepareJevRequest(tx, categories, [{ detail: 'salary', category: 'Sueldo', occurrences: 1 }]).payload.state.history.length, 0)
})

test('uses category definitions and excludes historical categories from new decisions', () => {
  const request = prepareJevRequest(tx, [
    { id: 'snacks', name: 'Café y snacks', type: 'Gasto', description: 'Café incluso con pareja.', is_active: true },
    { id: 'old', name: 'Comida', type: 'Gasto', is_active: false },
  ]);
  assert.deepEqual(request.payload.questions.category.criteria, { c0: 'Café y snacks: Café incluso con pareja.' });
  assert.ok(!JSON.stringify(request.payload).includes('Comida'));
});

test('adds Chilean merchant context only when the detail names a known merchant', async () => {
  const { chileanMerchantContext } = await import('../supabase/functions/_shared/chilean-merchants.ts')
  const context = (detail: string) => prepareJevRequest({ detail, type: 'Gasto' }, categories).payload.state.merchant_context
  assert.match(context('COMPRA JUMBO LA REINA')![0], /supermercado/)
  assert.match(context('LIDER EXPRESS PROVIDENCIA')![0], /Lider/)
  assert.match(context('Tottus Kennedy')![0], /Tottus/)
  assert.match(context('SANTA ISABEL 123')![0], /Santa Isabel/)
  assert.equal(context('Sushi para la cena')?.length ?? 0, 1)
  assert.equal(context('Regalo para mamá'), undefined)
  assert.deepEqual(chileanMerchantContext('UBER EATS PENDING'), ['Uber Eats: delivery de comida (no es viaje de Uber).'])
  assert.match(chileanMerchantContext('UBER *TRIP')[0], /viaje en auto/)
  // Weak, ambiguous words defer to a recognized merchant in the same detail.
  assert.deepEqual(chileanMerchantContext('MERPAGO*TOTTUS').map(d => d.split(':')[0]), ['Mercado Pago', 'Tottus'])
  assert.equal(chileanMerchantContext('COMERCIAL EASY SPA PARIS').length, 2)
  assert.deepEqual(chileanMerchantContext('JUMBO PARIS COSTANERA').length, 1)
})
