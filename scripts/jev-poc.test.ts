import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tryJevPoc, loadCategoryContext, categorizeBatchForUser, categorizeForUser } from '../supabase/functions/_shared/jev-poc.ts'

function database({ userId = 'owner', category = '⚡ Analizando...', updated = true, metadata = false } = {}) {
  const calls: { table: string; op: string; args: unknown[] }[] = []
  const client = {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from(table: string) {
      let isUpdate = false
      let isHistory = false
      const builder = {
        select(...args: unknown[]) { calls.push({ table, op: 'select', args }); return builder },
        update(...args: unknown[]) { isUpdate = true; calls.push({ table, op: 'update', args }); return builder },
        eq(...args: unknown[]) { calls.push({ table, op: 'eq', args }); return builder },
        is(...args: unknown[]) { calls.push({ table, op: 'is', args }); return builder },
        not(...args: unknown[]) { calls.push({ table, op: 'not', args }); return builder },
        order(...args: unknown[]) { calls.push({ table, op: 'order', args }); return builder },
        range(...args: unknown[]) { isHistory = true; calls.push({ table, op: 'range', args }); return builder },
        single: async () => ({ data: { id: 'tx', detail: 'sushi', type: 'Gasto', category_name: category }, error: null }),
        then(resolve: (value: unknown) => void) {
          resolve({ data: isUpdate ? (updated ? [{ id: 'tx' }] : []) : isHistory ? [] : [{ id: 'food', name: 'Restaurantes', type: 'Gasto', ...(metadata ? { description: 'Comidas sociales completas.', is_active: true } : {}) }], error: null })
        },
      }
      return builder
    },
  }
  return { client: client as unknown as Parameters<typeof tryJevPoc>[0], calls }
}

test('rejects missing authentication before reading movements', async () => {
  const db = database({ userId: '' })
  await assert.rejects(tryJevPoc(db.client, { transactionId: 'tx' }, { apiKey: '' }), /Sesión inválida/)
  assert.equal(db.calls.length, 0)
})

test('requires the persisted movement id', async () => {
  await assert.rejects(tryJevPoc(database().client, {}, { apiKey: '' }), /Falta el movimiento/)
})

test('verifies the forwarded session token explicitly on the server', async t => {
  const db = database({ category: 'Manual' })
  t.mock.method(db.client.auth, 'getUser', async (token: string) => {
    assert.equal(token, 'user-session')
    return { data: { user: { id: 'owner' } }, error: null }
  })
  await tryJevPoc(db.client, { transactionId: 'tx' }, { apiKey: '', accessToken: 'user-session' })
})

test('preserves an already assigned manual category', async () => {
  const db = database({ category: 'Mi categoría' })
  const result = await tryJevPoc(db.client, { transactionId: 'tx' }, { apiKey: '' })
  assert.equal(result?.applied, false)
  assert.equal(result?.category, 'Mi categoría')
  assert.ok(!db.calls.some(c => c.op === 'update'))
})

test('provider unavailable leaves uncategorized, with owner and edit guards on the update', async () => {
  const db = database()
  const result = await tryJevPoc(db.client, { transactionId: 'tx' }, { apiKey: '' })
  assert.equal(result?.category, 'Sin categoría')
  const write = db.calls.findIndex(c => c.op === 'update')
  const filters = db.calls.slice(write).filter(c => c.op === 'eq').map(c => c.args)
  for (const filter of [['id', 'tx'], ['user_id', 'owner'], ['category_name', '⚡ Analizando...'], ['type', 'Gasto'], ['detail', 'sushi']]) {
    assert.ok(filters.some(f => JSON.stringify(f) === JSON.stringify(filter)), `missing guard: ${filter}`)
  }
  assert.ok(db.calls.some(c => c.table === 'categories' && c.op === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'))
})

test('a late response reports applied=false when a concurrent edit prevents the write', async () => {
  const result = await tryJevPoc(database({ updated: false }).client, { transactionId: 'tx' }, { apiKey: '' })
  assert.equal(result?.applied, false)
})

test('uses persisted transaction data and maps a successful provider choice before writing', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    const request = JSON.parse(init.body as string)
    assert.deepEqual(request.state.transaction, { detail: 'sushi', type: 'Gasto' })
    return Response.json({ answers: { category: {
      type: 'choice', choice: 'c0', confidence: 0.99, probabilities: { c0: 1 },
    } } })
  })
  const db = database()
  const untrustedBody = { transactionId: 'tx', detail: 'spoofed description', userId: 'another-user', existingCategories: ['Invented'] }
  const result = await tryJevPoc(db.client, untrustedBody, { apiKey: 'test' })
  assert.equal(result?.method, 'jev')
  assert.equal(result?.category, 'Restaurantes')
  assert.equal(result?.applied, true)
  assert.ok(db.calls.some(c => c.table === 'transactions' && c.op === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'))
  assert.deepEqual(db.calls.find(c => c.op === 'update')?.args, [{ category_name: 'Restaurantes' }])
})

test('does not reuse another owner’s category context', async () => {
  const db = database()
  await assert.rejects(categorizeForUser(db.client, 'tx', 'owner', { apiKey: '' }, { userId: 'other', history: [], categories: [] }), /otro usuario/)
  assert.equal(db.calls.length, 0)
})

test('history query is owner scoped and paginated, excluding pending/uncategorized entries', async () => {
  const db = database()
  await loadCategoryContext(db.client, 'owner')
  assert.ok(db.calls.some(c => c.op === 'range' && c.args[0] === 0 && c.args[1] === 999))
  assert.ok(db.calls.some(c => c.op === 'not' && c.args[0] === 'category_name'))
  assert.ok(db.calls.some(c => c.table === 'transactions' && c.op === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'))
})

test('batch reads history once and preserves already assigned movements', async () => {
  const db = database({ category: 'Manual' })
  const results = await categorizeBatchForUser(db.client, ['one', 'two', 'three'], 'owner', { apiKey: '' })
  assert.equal(results.length, 3)
  assert.ok(results.every(result => result.success && !result.applied && result.category === 'Manual'))
  assert.equal(db.calls.filter(c => c.op === 'range').length, 1)
  assert.ok(!db.calls.some(c => c.op === 'update'))
})

test('loads saved definitions and provenance after migration and marks only accepted predictions as Jev', async t => {
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    const request = JSON.parse(init.body as string);
    assert.equal(request.questions.category.criteria.c0, 'Restaurantes: Comidas sociales completas.');
    return Response.json({ answers: { category: { type: 'choice', choice: 'c0', confidence: 0.9, probabilities: { c0: 1 } } } });
  });
  const db = database({ metadata: true });
  await tryJevPoc(db.client, { transactionId: 'tx' }, { apiKey: 'test' });
  assert.ok(db.calls.some(c => c.op === 'select' && String(c.args[0]).includes('category_source')));
  assert.deepEqual(db.calls.find(c => c.op === 'update')?.args, [{ category_name: 'Restaurantes', category_source: 'jev' }]);
  const unavailable = database({ metadata: true });
  await tryJevPoc(unavailable.client, { transactionId: 'tx' }, { apiKey: '' });
  assert.deepEqual(unavailable.calls.find(c => c.op === 'update')?.args, [{ category_name: 'Sin categoría', category_source: null }]);
});
