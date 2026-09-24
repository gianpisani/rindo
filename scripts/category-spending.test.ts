import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeCategoryPeriod } from '../src/lib/category-spending.ts';
import { withManualCategorySource } from '../src/lib/auto-category-policy.ts';
const start = new Date('2026-09-01T00:00:00Z');
const end = new Date('2026-09-30T23:59:59Z');
const base = { date: '2026-09-10T12:00:00Z', category_name: 'Comidas y panoramas', amount: 60000, type: 'Gasto' };
test('counts purchases only and subtracts both supported reimbursement types from their target', () => {
  const rows = summarizeCategoryPeriod([base,
    { ...base, amount: 20000, type: 'Ingreso', category_name: 'Reembolsos', reimbursement_for_category: base.category_name },
    { ...base, amount: 10000, type: 'Reembolso', category_name: 'Reembolsos', reimbursement_for_category: base.category_name },
    { ...base, amount: 9000, type: 'Ingreso', reimbursement_for_category: 'Supermercado' },
    { ...base, amount: 30000, type: 'Ingreso' },
  ], start, end);
  assert.equal(rows.get(base.category_name)?.effectiveAmount, 30000);
  assert.equal(rows.get(base.category_name)?.count, 1);
  assert.equal(rows.get(base.category_name)?.transactions.length, 1);
  assert.equal(rows.get('Supermercado')?.effectiveAmount, 0);
});
test('period comparisons apply the same net formula and do not mix months', () => {
  const entries = [base, { ...base, type: 'Ingreso', amount: 30000, reimbursement_for_category: base.category_name },
    { ...base, date: '2026-08-10T12:00:00Z' },
    { ...base, date: '2026-08-12T12:00:00Z', type: 'Ingreso', amount: 30000, reimbursement_for_category: base.category_name }];
  const current = summarizeCategoryPeriod(entries, start, end).get(base.category_name)!;
  const previous = summarizeCategoryPeriod(entries, new Date('2026-08-01'), new Date('2026-08-31T23:59:59Z')).get(base.category_name)!;
  assert.equal(current.effectiveAmount, previous.effectiveAmount);
  assert.equal(current.count, 1);
});
test('records explicit choices without labelling old or pending predictions as confirmed', () => {
  assert.deepEqual(withManualCategorySource({ category_name: 'Comida diaria' }, true), { category_name: 'Comida diaria', category_source: 'manual' });
  assert.deepEqual(withManualCategorySource({ category_name: '⚡ Analizando...' }, true), { category_name: '⚡ Analizando...', category_source: null });
  assert.deepEqual(withManualCategorySource({ detail: 'cena' } as { detail: string; category_name?: string }, true), { detail: 'cena' });
  assert.deepEqual(withManualCategorySource({ category_name: 'Comida' }, false), { category_name: 'Comida' });
});
