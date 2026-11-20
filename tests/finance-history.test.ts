import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildHistory, categoryTrends, historyAverages, monthsBetween } from '../src/lib/finance-history.ts';

const m = (year: number, month: number) => new Date(year, month, 1);

test('months run from the first with data to the current one, capped to the most recent', () => {
  const months = monthsBetween(new Date(2025, 10, 17), new Date(2026, 1, 3));
  assert.deepEqual(months.map((d) => [d.getFullYear(), d.getMonth()]), [[2025, 10], [2025, 11], [2026, 0], [2026, 1]]);
  assert.equal(monthsBetween(new Date(2020, 0, 1), new Date(2026, 1, 1), 12).length, 12);
});

test('what is left is income minus spending minus the net moved to investments', () => {
  const [point] = buildHistory(
    [m(2026, 7)],
    () => ({ ingreso: 1_900_000, gasto: 1_600_000, invertido: 150_000 }),
    () => ({ liquido: 300_000, invertido: 5_000_000 })
  );
  assert.equal(point.quedo, 150_000);
  assert.equal(point.patrimonio, 5_300_000);
});

test('averages ignore the month in progress and count months without income', () => {
  const points = buildHistory(
    [m(2026, 6), m(2026, 7), m(2026, 8)],
    (month) => month.getMonth() === 6
      ? { ingreso: 0, gasto: 400_000, invertido: 0 }
      : { ingreso: 2_000_000, gasto: 1_600_000, invertido: 0 },
    () => ({ liquido: 0, invertido: 0 })
  );
  const averages = historyAverages(points, new Date(2026, 8, 15));
  assert.equal(averages.months, 2);
  assert.equal(averages.ingreso, 1_000_000);
  assert.equal(averages.gasto, 1_000_000);
  assert.equal(averages.ahorro, 0);
});

test('category trends rank by total and average only closed months', () => {
  const months = [m(2026, 6), m(2026, 7), m(2026, 8)];
  const spend = new Map([
    [6, new Map([['Comida', 100_000], ['Café', 10_000]])],
    [7, new Map([['Comida', 200_000], ['Café', 30_000]])],
    [8, new Map([['Comida', 50_000]])],
  ]);
  const trends = categoryTrends(months, (start) => spend.get(start.getMonth())!, new Date(2026, 8, 10));
  assert.equal(trends[0].category, 'Comida');
  assert.deepEqual(trends[0].perMonth, [100_000, 200_000, 50_000]);
  assert.equal(trends[0].average, 150_000);
  assert.equal(trends[1].average, 20_000);
});
