import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applicablePart,
  changedFields,
  describeMissing,
  describeUndone,
  historySize,
  historyStorageKey,
  isApplePlatform,
  isEditEntry,
  keepNewest,
  parseStoredHistory,
  returnToFuture,
  returnToPast,
  serializeHistory,
  touchedIds,
  undoShortcuts,
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
  assert.equal(describeUpdate({ amount: 1, detail: 'x' }, 1), 'Movimiento editado');
  assert.equal(describeUpdate({ amount: 1 }, 2), '2 movimientos actualizados');
  assert.equal(describeRemoval(1), 'Movimiento borrado');
  assert.equal(describeRemoval(4), '4 movimientos borrados');
  assert.equal(describeDuplicate(2), '2 movimientos duplicados');
  assert.equal(describeUndone('Movimiento borrado'), 'Deshecho: Movimiento borrado');
  assert.equal(describeMissing(1), 'Ese movimiento ya no existe');
  assert.equal(describeMissing(2), 'Esos movimientos ya no existen');
});

const row = (id: string) => ({ id, date: '2026-11-20T10:00:00Z', amount: 1200, type: 'Gasto', category_name: 'Comida', detail: 'Pan' });
const removal = (id: string) => ({ label: 'Movimiento borrado', redo: { kind: 'remove', rows: [row(id)] }, undo: { kind: 'restore', rows: [row(id)] } });
const recategorize = (id: string) => ({
  label: 'Categoría → Supermercado',
  redo: { kind: 'patch', patches: [{ id, category_name: 'Supermercado' }] },
  undo: { kind: 'patch', patches: [{ id, category_name: 'Comida' }] },
});

test('a stored history survives a round trip', () => {
  const history = stepBack(record(record(emptyHistory<object>(), removal('a')), recategorize('b')))!.history;
  const restored = parseStoredHistory(JSON.parse(serializeHistory(history)), isEditEntry);
  assert.deepEqual(restored, history);
});

test('a stored history with an unexpected shape is rejected', () => {
  const valid = JSON.parse(serializeHistory(record(emptyHistory<object>(), removal('a'))));
  assert.equal(parseStoredHistory(null, isEditEntry), null);
  assert.equal(parseStoredHistory('texto', isEditEntry), null);
  assert.equal(parseStoredHistory({ ...valid, version: 99 }, isEditEntry), null);
  assert.equal(parseStoredHistory({ ...valid, past: 'nope' }, isEditEntry), null);
  assert.equal(parseStoredHistory({ ...valid, past: [{ label: 'x' }] }, isEditEntry), null);
  assert.equal(parseStoredHistory({ ...valid, past: [{ ...removal('a'), undo: { kind: 'restore', rows: [{ id: 'a' }] } }] }, isEditEntry), null);
  assert.equal(parseStoredHistory({ ...valid, past: [{ ...recategorize('a'), redo: { kind: 'patch', patches: [] } }] }, isEditEntry), null);
  assert.equal(parseStoredHistory({ ...valid, future: [{ ...removal('a'), undo: { kind: 'explode', rows: [row('a')] } }] }, isEditEntry), null);
});

test('a stored history never grows past the limit', () => {
  const past = Array.from({ length: 70 }, (_, i) => removal(String(i)));
  const restored = parseStoredHistory({ version: 1, past, future: [removal('x')] }, isEditEntry)!;
  assert.equal(historySize(restored), 50);
  assert.equal(restored.past[0], past[20]);
  assert.deepEqual(restored.future, []);
});

test('keepNewest drops the oldest steps first', () => {
  const history = { past: ['a', 'b', 'c'], future: ['d', 'e'] };
  assert.deepEqual(keepNewest(history, 4), { past: ['a', 'b', 'c'], future: ['d'] });
  assert.deepEqual(keepNewest(history, 2), { past: ['b', 'c'], future: [] });
  assert.deepEqual(keepNewest(history, 0), { past: [], future: [] });
});

test('a failed undo or redo puts the entry back where it was', () => {
  const recorded = record(record(emptyHistory<string>(), 'a'), 'b');
  const undone = stepBack(recorded)!;
  assert.deepEqual(returnToPast(undone.history, undone.entry), recorded);
  const redone = stepForward(undone.history)!;
  assert.deepEqual(returnToFuture(redone.history, redone.entry), undone.history);
});

test('history keys are per user', () => {
  assert.notEqual(historyStorageKey('u1'), historyStorageKey('u2'));
});

test('touchedIds lists the rows an operation affects', () => {
  assert.deepEqual(touchedIds({ kind: 'patch', patches: [{ id: 'b' }] }), ['b']);
  assert.deepEqual(touchedIds({ kind: 'restore', rows: [row('a'), row('c')] }), ['a', 'c']);
});

test('applicablePart keeps only what can still be applied', () => {
  const exists = (id: string) => id !== 'gone';
  const patch = { kind: 'patch' as const, patches: [{ id: 'a' }, { id: 'gone' }] };
  assert.deepEqual(applicablePart(patch, exists), { kind: 'patch', patches: [{ id: 'a' }] });
  assert.equal(applicablePart({ kind: 'patch', patches: [{ id: 'gone' }] }, exists), null);
  assert.deepEqual(applicablePart({ kind: 'restore', rows: [row('a'), row('gone')] }, exists), { kind: 'restore', rows: [row('gone')] });
  assert.equal(applicablePart({ kind: 'restore', rows: [row('a')] }, exists), null);
  assert.deepEqual(applicablePart({ kind: 'remove', rows: [row('a'), row('gone')] }, exists), { kind: 'remove', rows: [row('a')] });
});

test('shortcuts follow the platform', () => {
  assert.equal(isApplePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), true);
  assert.equal(isApplePlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), false);
  assert.deepEqual(undoShortcuts(true), { undo: '⌘Z', redo: '⇧⌘Z' });
  assert.deepEqual(undoShortcuts(false), { undo: 'Ctrl+Z', redo: 'Ctrl+Y' });
});
