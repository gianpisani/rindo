import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  changedFields,
  describeDuplicate,
  describeRemoval,
  describeUpdate,
  emptyHistory,
  forget,
  groupPatches,
  record,
  revertPatch,
  stepBack,
  stepForward,
} from '../src/lib/edit-history.ts';

test('undo and redo walk entries one by one in order', () => {
  let history = record(record(record(emptyHistory<string>(), 'a'), 'b'), 'c');

  const undoC = stepBack(history)!;
  assert.equal(undoC.entry, 'c');
  const undoB = stepBack(undoC.history)!;
  assert.equal(undoB.entry, 'b');
  history = undoB.history;
  assert.deepEqual(history, { past: ['a'], future: ['b', 'c'] });

  const redoB = stepForward(history)!;
  assert.equal(redoB.entry, 'b');
  assert.deepEqual(redoB.history, { past: ['a', 'b'], future: ['c'] });
});

test('nothing to undo or redo returns null', () => {
  assert.equal(stepBack(emptyHistory()), null);
  assert.equal(stepForward(emptyHistory()), null);
});

test('a new edit clears the redo stack', () => {
  const undone = stepBack(record(record(emptyHistory<string>(), 'a'), 'b'))!.history;
  assert.deepEqual(record(undone, 'x'), { past: ['a', 'x'], future: [] });
});

test('history keeps only the latest entries', () => {
  let history = emptyHistory<number>();
  for (let i = 1; i <= 60; i++) history = record(history, i);
  assert.equal(history.past.length, 50);
  assert.equal(history.past[0], 11);
  assert.deepEqual(record(record(emptyHistory<number>(), 1, 2), 2, 2).past, [1, 2]);
  assert.deepEqual(record(record(record(emptyHistory<number>(), 1, 2), 2, 2), 3, 2).past, [2, 3]);
});

test('forget drops an entry from both stacks', () => {
  const a = { n: 1 };
  const b = { n: 2 };
  const undone = stepBack(record(record(emptyHistory<object>(), a), b))!.history;
  assert.deepEqual(forget(undone, b), { past: [a], future: [] });
  assert.deepEqual(forget(undone, a), { past: [], future: [b] });
});

test('changedFields keeps only what really changes', () => {
  const before = { amount: 100, detail: 'Pan', category_name: 'Comida' };
  assert.deepEqual(changedFields(before, { amount: 100, detail: 'Pan y leche' }), { detail: 'Pan y leche' });
  assert.deepEqual(changedFields(before, { amount: 100 }), {});
});

test('revertPatch takes the previous value of each changed field', () => {
  const before = { amount: 100, detail: 'Pan', card_id: undefined as string | undefined, category_name: 'Comida' };
  assert.deepEqual(revertPatch(before, { amount: 250, card_id: 'visa' }), { amount: 100, card_id: null });
});

test('groupPatches joins rows that get the same change', () => {
  const groups = groupPatches([
    { id: '1', category_name: 'Comida', category_source: 'manual' },
    { id: '2', category_name: 'Bencina', category_source: null },
    { id: '3', category_source: 'manual', category_name: 'Comida' },
  ]);
  assert.deepEqual(groups, [
    { ids: ['1', '3'], changes: { category_name: 'Comida', category_source: 'manual' } },
    { ids: ['2'], changes: { category_name: 'Bencina', category_source: null } },
  ]);
});

test('labels are short and say what changed', () => {
  assert.equal(describeUpdate({ category_name: 'Supermercado', category_source: 'manual' }, 1), 'Categoría → Supermercado');
  assert.equal(describeUpdate({ category_name: 'Supermercado' }, 3), '3 movimientos → Supermercado');
  assert.equal(describeUpdate({ amount: 1200 }, 1), 'Monto actualizado');
  assert.equal(describeUpdate({ date: '2026-11-20' }, 1), 'Fecha actualizada');
  assert.equal(describeUpdate({ amount: 1, detail: 'x' }, 1), 'Movimiento actualizado');
  assert.equal(describeUpdate({ amount: 1 }, 2), '2 movimientos actualizados');
  assert.equal(describeRemoval(1), 'Movimiento borrado');
  assert.equal(describeRemoval(4), '4 movimientos borrados');
  assert.equal(describeDuplicate(2), '2 movimientos duplicados');
});
