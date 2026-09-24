import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test, type TestContext } from 'node:test'
import { createLocalCategorizer } from './jev-local-server.ts'
import { ANALYZING_CATEGORY, shouldCategorize } from '../src/lib/auto-category-policy.ts'

async function setup(t: TestContext) {
  const calls: unknown[] = []
  const handler = createLocalCategorizer(async (authorization, body) => {
    calls.push({ authorization, body })
    return { success: true, applied: true, category: 'Restaurantes' }
  })
  const server = createServer((req, res) => { void handler(req, res, () => { res.writeHead(404); res.end() }) })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const headers = { Origin: url, Authorization: 'Bearer test-session', 'Content-Type': 'application/json', 'X-Rindo-Jev': '1' }
  const post = (overrides: RequestInit = {}) => fetch(`${url}/__auto-categorize`, { method: 'POST', headers, body: JSON.stringify({ transactionId: 'tx' }), ...overrides })
  return { headers, post, calls }
}

test('automatically classifies supported movements with detail and no manual selection', () => {
  for (const type of ['Gasto', 'Ingreso', 'Inversión']) {
    assert.equal(shouldCategorize({ type, detail: 'Sushi para la cena', category_name: '' }), true)
    assert.equal(shouldCategorize({ type, detail: 'Sushi para la cena', category_name: ANALYZING_CATEGORY }), true)
  }
})

test('preserves manual categories, explicit uncategorized choices, fixed types and empty details', () => {
  for (const category_name of ['Restaurantes', 'Sin categoría']) {
    assert.equal(shouldCategorize({ type: 'Gasto', detail: 'Sushi para la cena', category_name }), false)
  }
  for (const type of ['Rescate', 'Rendimiento', 'Reembolso']) {
    assert.equal(shouldCategorize({ type, detail: 'Ajuste del fondo', category_name: '' }), false)
  }
  for (const detail of [null, '', '  ', 'ab']) {
    assert.equal(shouldCategorize({ type: 'Gasto', detail, category_name: '' }), false)
  }
})

test('forwards the session and persisted id, discarding untrusted descriptions and owners', async t => {
  const app = await setup(t)
  const result = await app.post({ body: JSON.stringify({ transactionId: 'tx', userId: 'another-user', detail: 'invented', categories: ['invented'] }) })
  assert.equal(result.status, 200)
  assert.deepEqual(app.calls, [{ authorization: 'Bearer test-session', body: { transactionId: 'tx' } }])
})

test('requires a session and rejects other origins and rebinding hosts before categorization', async t => {
  const app = await setup(t)
  assert.equal((await app.post({ headers: { ...app.headers, Authorization: '' } })).status, 401)
  for (const headers of [
    { ...app.headers, Origin: 'https://untrusted.example' },
    { ...app.headers, 'X-Rindo-Jev': '' },
    { ...app.headers, Host: 'untrusted.example', Origin: 'http://untrusted.example' },
  ]) assert.equal((await app.post({ headers })).status, 403)
  assert.equal(app.calls.length, 0)
})

test('rejects invalid and oversized inputs before categorization', async t => {
  const app = await setup(t)
  for (const body of ['{broken', '{}', JSON.stringify({ transactionId: 12 })]) {
    assert.equal((await app.post({ body })).status, 400)
  }
  assert.equal((await app.post({ body: 'x'.repeat(5000) })).status, 413)
  assert.equal(app.calls.length, 0)
})

test('bounds local requests to sixty per minute', async t => {
  const app = await setup(t)
  for (let i = 0; i < 60; i++) assert.equal((await app.post()).status, 200)
  assert.equal((await app.post()).status, 429)
  assert.equal(app.calls.length, 60)
})
