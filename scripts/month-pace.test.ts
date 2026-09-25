import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeMonthPace, paceVerdict } from '../src/lib/month-pace.ts';

const gasto = (date: string, amount: number, category_name = 'Comida') => ({ type: 'Gasto', date, amount, category_name });
const today = new Date(2026, 8, 15, 12);

test('compares spending so far with the typical month at the same day', () => {
  const entries = [
    gasto('2026-06-05T12:00:00', 100_000), gasto('2026-06-20T12:00:00', 100_000),
    gasto('2026-07-05T12:00:00', 120_000), gasto('2026-07-20T12:00:00', 100_000),
    gasto('2026-08-05T12:00:00', 80_000), gasto('2026-08-20T12:00:00', 100_000),
    gasto('2026-09-03T12:00:00', 40_000),
  ];
  const pace = computeMonthPace(entries, today, { today });
  assert.equal(pace.isLive, true);
  assert.equal(pace.asOfDay, 15);
  assert.equal(pace.typicalMonths, 3);
  assert.equal(pace.spentSoFar, 40_000);
  assert.equal(pace.typicalSoFar, 100_000);
  assert.equal(pace.delta, -60_000);
  assert.equal(pace.typicalTotal, 200_000);
  assert.equal(pace.projectedTotal, 140_000);
  assert.equal(paceVerdict(pace), 'under');
  assert.equal(pace.drivers[0].category, 'Comida');
});

test('reimbursements net against their category and transit is ignored', () => {
  const entries = [
    gasto('2026-08-02T12:00:00', 50_000, 'Super'),
    gasto('2026-09-02T12:00:00', 80_000, 'Super'),
    gasto('2026-09-02T12:00:00', 999_000, 'Reembolsos'),
    { type: 'Ingreso', date: '2026-09-04T12:00:00', amount: 30_000, category_name: 'Reembolsos', reimbursement_for_category: 'Super' },
  ];
  const pace = computeMonthPace(entries, today, { today });
  assert.equal(pace.spentSoFar, 50_000);
  assert.equal(paceVerdict(pace), 'even');
});

test('a closed month is measured at its last day without projection', () => {
  const entries = [gasto('2026-07-10T12:00:00', 100_000), gasto('2026-08-10T12:00:00', 150_000)];
  const pace = computeMonthPace(entries, new Date(2026, 7, 1), { today });
  assert.equal(pace.isLive, false);
  assert.equal(pace.asOfDay, 31);
  assert.equal(pace.projectedTotal, 150_000);
  assert.equal(pace.delta, 50_000);
  assert.equal(paceVerdict(pace), 'over');
});
