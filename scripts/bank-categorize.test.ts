import assert from 'node:assert/strict'
import { test } from 'node:test'
import { categorizeBankImport, merchantSearchTerm } from '../supabase/functions/_shared/bank-categorize.ts'

// Jev runs without an API key, so it always leaves the movement uncategorized.
function database({ similar = [] as string[], categoryNow = 'Sin categoría' } = {}) {
  const calls: { op: string; args: unknown[] }[] = []
  const client = {
    from(table: string) {
      let kind: 'categories' | 'history' | 'similar' | 'update' | 'other' = table === 'categories' ? 'categories' : 'other'
      const builder = {
        select(...args: unknown[]) { calls.push({ op: 'select', args }); return builder },
        update(...args: unknown[]) { kind = 'update'; calls.push({ op: 'update', args }); return builder },
        eq(...args: unknown[]) { calls.push({ op: 'eq', args }); return builder },
        is(...args: unknown[]) { return builder },
        not(...args: unknown[]) { calls.push({ op: 'not', args }); return builder },
        ilike(...args: unknown[]) { kind = 'similar'; calls.push({ op: 'ilike', args }); return builder },
        order() { return builder },
        limit() { return builder },
        range() { kind = 'history'; return builder },
        single: async () => ({ data: { id: 'tx1', detail: '🤖 COMPRA JUMBO COSTANERA', type: 'Gasto', category_name: 'Sin categoría' }, error: null }),
        then(resolve: (value: unknown) => void) {
          const data = kind === 'categories' ? [{ id: 'c1', name: 'Supermercado', type: 'Gasto' }]
            : kind === 'similar' ? similar.map(category_name => ({ category_name }))
            : kind === 'update' ? (categoryNow === 'Sin categoría' ? [{ id: 'tx1' }] : [])
            : []
          resolve({ data, error: null })
        },
      }
      return builder
    },
  }
  return { client: client as never, calls }
}

test('skips generic bank prefixes when picking the merchant word', () => {
  assert.equal(merchantSearchTerm('COMPRA JUMBO COSTANERA'), 'jumbo')
  assert.equal(merchantSearchTerm('Traspaso A: Juan Pérez'), 'juan')
  assert.equal(merchantSearchTerm('PAGO 123456'), null)
})

test('falls back to the most frequent past category when Jev leaves it uncategorized', async () => {
  const db = database({ similar: ['Supermercado', 'Comida', 'Supermercado'] })
  await categorizeBankImport(db.client, [{ id: 'tx1', detail: 'COMPRA JUMBO COSTANERA', type: 'Gasto' }], 'owner', { apiKey: '' })
  const updates = db.calls.filter(c => c.op === 'update')
  assert.deepEqual(updates.at(-1)?.args[0], { category_name: 'Supermercado' })
  assert.ok(db.calls.some(c => c.op === 'ilike' && c.args[1] === '%jumbo%'))
  assert.ok(db.calls.some(c => c.op === 'eq' && c.args[0] === 'type' && c.args[1] === 'Gasto'))
  assert.ok(db.calls.some(c => c.op === 'eq' && c.args[0] === 'category_name' && c.args[1] === 'Sin categoría'))
})

test('leaves the movement uncategorized when there is no similar history', async () => {
  const db = database()
  await categorizeBankImport(db.client, [{ id: 'tx1', detail: 'COMPRA JUMBO', type: 'Gasto' }], 'owner', { apiKey: '' })
  assert.ok(!db.calls.some(c => c.op === 'update' && (c.args[0] as { category_name?: string }).category_name === 'Supermercado'))
})
