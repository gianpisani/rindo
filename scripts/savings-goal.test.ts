import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeNextMonthSweep,
  computeSavingsMonths,
  savingsMonthOf,
} from '../src/lib/savings-goal.ts';

const inv = (date: string, amount: number) => ({ type: 'Inversión', date, amount });
const resc = (date: string, amount: number) => ({ type: 'Rescate', date, amount });
const gasto = (date: string, amount: number, detail: string | null = null, category_name = 'Comida') =>
  ({ type: 'Gasto', date, amount, detail, category_name });

const GOAL = 1_500_000;
const september = new Date(2026, 8, 26, 12);

test('an investment on day ≥ 25 funds the next month, earlier ones the same month', () => {
  assert.equal(savingsMonthOf(inv('2026-08-29T15:00:00', 1)).getMonth(), 8);
  assert.equal(savingsMonthOf(inv('2026-08-24T15:00:00', 1)).getMonth(), 7);
  assert.equal(savingsMonthOf(inv('2026-12-29T15:00:00', 1)).getFullYear(), 2027);
  assert.equal(savingsMonthOf(resc('2026-08-29T15:00:00', 1)).getMonth(), 7);
  assert.equal(savingsMonthOf(gasto('2026-08-29T15:00:00', 1)), null);
});

test('twelve months ending in the current one, oldest first, with sweeps and rescues', () => {
  const entries = [
    inv('2026-08-29T15:00:00', 1_000_000),
    inv('2026-09-02T15:00:00', 58_400),
    inv('2026-09-02T16:00:00', 58_400),
    resc('2026-09-08T15:00:00', 200_000),
    inv('2026-02-12T15:00:00', 1_300_000),
    inv('2026-01-28T15:00:00', 500_000),
    inv('2025-09-26T15:00:00', 200_000),
  ];
  const months = computeSavingsMonths(entries, GOAL, september);
  assert.equal(months.length, 12);
  assert.equal(months[0].key, '2025-10');
  assert.equal(months[11].key, '2026-09');

  const sep = months[11];
  assert.equal(sep.invested, 1_116_800);
  assert.equal(sep.rescued, 200_000);
  assert.equal(sep.saved, 916_800);
  assert.equal(sep.met, false);
  assert.deepEqual(sep.sweeps.map((s) => s.amount), [1_000_000, 58_400, 58_400]);

  const feb = months.find((m) => m.key === '2026-02')!;
  assert.equal(feb.saved, 1_800_000);
  assert.equal(feb.met, true);

  assert.equal(months[0].saved, 200_000);
  assert.equal(months.filter((m) => m.met).length, 1);
});

test('a rescue larger than the contributions shows as zero, never negative', () => {
  const months = computeSavingsMonths([inv('2026-09-02T15:00:00', 50_000), resc('2026-09-08T15:00:00', 200_000)], GOAL, september);
  assert.equal(months[11].saved, 0);
});

test('the biggest hit is the largest expense of the calendar month, ignoring transit', () => {
  const entries = [
    gasto('2026-06-10T15:00:00', 577_000, 'Hotel París', 'Viajes y hospedaje'),
    gasto('2026-06-12T15:00:00', 120_000, '  ', 'Comida'),
    gasto('2026-06-13T15:00:00', 900_000, 'Luz y agua', 'Reembolsos'),
  ];
  const months = computeSavingsMonths(entries, GOAL, september);
  const jun = months.find((m) => m.key === '2026-06')!;
  assert.deepEqual(jun.biggestHit, { label: 'Hotel París', amount: 577_000 });
  const none = months.find((m) => m.key === '2026-07')!;
  assert.equal(none.biggestHit, null);
});

test('a blank detail falls back to the category name', () => {
  const months = computeSavingsMonths([gasto('2026-06-12T15:00:00', 120_000, '  ', 'Comida')], GOAL, september);
  assert.equal(months.find((m) => m.key === '2026-06')!.biggestHit!.label, 'Comida');
});

test('what was already swept for next month is visible from the current one', () => {
  const entries = [inv('2026-09-29T15:00:00', 1_300_000), inv('2026-09-02T15:00:00', 58_400)];
  const sweeps = computeNextMonthSweep(entries, september);
  assert.deepEqual(sweeps.map((s) => s.amount), [1_300_000]);
  assert.equal(computeNextMonthSweep([inv('2026-09-02T15:00:00', 1)], september).length, 0);
});

test('without a goal nothing counts as met', () => {
  const months = computeSavingsMonths([inv('2026-09-02T15:00:00', 5_000_000)], 0, september);
  assert.equal(months[11].met, false);
});
