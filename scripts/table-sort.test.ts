import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SORT, consecutiveSections, isDefaultSort, nextSort, sectionKindOf } from '../src/lib/table-sort.ts';

test('amount cycles biggest first, smallest first, then back to newest first', () => {
  const first = nextSort(DEFAULT_SORT, 'amount');
  assert.deepEqual(first, [{ id: 'amount', desc: true }]);
  const second = nextSort(first, 'amount');
  assert.deepEqual(second, [{ id: 'amount', desc: false }]);
  assert.deepEqual(nextSort(second, 'amount'), DEFAULT_SORT);
});

test('category starts A to Z and date toggles between oldest and newest first', () => {
  assert.deepEqual(nextSort(DEFAULT_SORT, 'category_name'), [{ id: 'category_name', desc: false }]);
  const oldest = nextSort(DEFAULT_SORT, 'date');
  assert.deepEqual(oldest, [{ id: 'date', desc: false }]);
  assert.ok(isDefaultSort(nextSort(oldest, 'date')));
});

test('switching column starts the new column at its first direction', () => {
  assert.deepEqual(nextSort([{ id: 'amount', desc: false }], 'category_name'), [{ id: 'category_name', desc: false }]);
});

test('sections follow the sort so the list keeps the same shape', () => {
  assert.equal(sectionKindOf(DEFAULT_SORT), 'day');
  assert.equal(sectionKindOf([{ id: 'date', desc: false }]), 'day');
  assert.equal(sectionKindOf([{ id: 'category_name', desc: false }]), 'category');
  assert.equal(sectionKindOf([{ id: 'amount', desc: true }]), 'single');
});

test('consecutive sections keep order and the start index of each', () => {
  const sections = consecutiveSections(['a1', 'a2', 'b1', 'a3'], (item) => item[0]);
  assert.deepEqual(sections.map((s) => [s.key, s.start, s.items.length]), [['a', 0, 2], ['b', 2, 1], ['a', 3, 1]]);
});
