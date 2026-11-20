import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dayOfPeriod,
  daysInPeriod,
  isInPeriod,
  normalizeStartDay,
  periodEndOf,
  periodKey,
  periodMonthName,
  periodNameDate,
  periodRangeLabel,
  periodsBetween,
  periodStartOf,
  shiftPeriod,
  startDayFromEndDay,
} from '../src/lib/period.ts';

const d = (y: number, m: number, day: number, h = 12) => new Date(y, m - 1, day, h);

test('start day 1 is the calendar month', () => {
  const start = periodStartOf(d(2026, 11, 14), 1);
  assert.deepEqual(start, new Date(2026, 10, 1));
  assert.deepEqual(periodEndOf(start, 1), new Date(2026, 10, 30, 23, 59, 59, 999));
  assert.equal(daysInPeriod(start, 1), 30);
  assert.equal(periodKey(start), '2026-11');
});

test('start day 15 splits on the 14th/15th', () => {
  assert.deepEqual(periodStartOf(d(2026, 11, 14), 15), new Date(2026, 9, 15));
  assert.deepEqual(periodStartOf(d(2026, 11, 15, 0), 15), new Date(2026, 10, 15));
  const nov = new Date(2026, 10, 15);
  assert.deepEqual(periodEndOf(nov, 15), new Date(2026, 11, 14, 23, 59, 59, 999));
  assert.equal(isInPeriod(d(2026, 12, 14, 23), nov, 15), true);
  assert.equal(isInPeriod(d(2026, 12, 15, 0), nov, 15), false);
  assert.equal(periodRangeLabel(nov, 15), '15 nov – 14 dic');
  assert.equal(daysInPeriod(nov, 15), 30);
});

test('crosses the year boundary', () => {
  const dec = periodStartOf(d(2027, 1, 10), 15);
  assert.deepEqual(dec, new Date(2026, 11, 15));
  assert.equal(periodRangeLabel(dec, 15), '15 dic – 14 ene');
  assert.deepEqual(shiftPeriod(dec, 1, 15), new Date(2027, 0, 15));
  assert.deepEqual(shiftPeriod(dec, -12, 15), new Date(2025, 11, 15));
});

test('start days missing in short months clamp to the last day', () => {
  const jan = new Date(2027, 0, 31);
  const feb = shiftPeriod(jan, 1, 31);
  assert.deepEqual(feb, new Date(2027, 1, 28));
  assert.deepEqual(shiftPeriod(feb, 1, 31), new Date(2027, 2, 31));
  assert.equal(daysInPeriod(jan, 31), 28);
  assert.deepEqual(periodStartOf(d(2027, 3, 1), 31), feb);
});

test('day of period and ranges', () => {
  const nov = new Date(2026, 10, 15);
  assert.equal(dayOfPeriod(d(2026, 11, 15), nov), 1);
  assert.equal(dayOfPeriod(d(2026, 12, 14), nov), 30);
  const list = periodsBetween(d(2026, 9, 20), d(2026, 11, 14), 15);
  assert.deepEqual(list, [new Date(2026, 8, 15), new Date(2026, 9, 15)]);
});

test('end day ↔ start day', () => {
  assert.equal(startDayFromEndDay(14), 15);
  assert.equal(startDayFromEndDay(0), 1);
  assert.equal(normalizeStartDay(0), 1);
  assert.equal(normalizeStartDay(40), 1);
});

test('a period is named after the month it ends', () => {
  assert.equal(periodMonthName(new Date(2026, 10, 15), 15), 'diciembre');
  assert.equal(periodMonthName(new Date(2026, 9, 25), 25), 'noviembre');
  assert.equal(periodMonthName(new Date(2026, 10, 1), 1), 'noviembre');
  assert.deepEqual(periodNameDate(new Date(2026, 11, 15), 15), new Date(2027, 0, 14));
});
