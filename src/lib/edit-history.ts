export const EDIT_HISTORY_LIMIT = 50;

export interface History<T> {
  past: T[];
  future: T[];
}

export interface Step<T> {
  history: History<T>;
  entry: T;
}

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [] });

export function record<T>(history: History<T>, entry: T, limit = EDIT_HISTORY_LIMIT): History<T> {
  return { past: [...history.past, entry].slice(-limit), future: [] };
}

export function stepBack<T>(history: History<T>): Step<T> | null {
  const entry = history.past.at(-1);
  if (entry === undefined) return null;
  return { entry, history: { past: history.past.slice(0, -1), future: [entry, ...history.future] } };
}

export function stepForward<T>(history: History<T>): Step<T> | null {
  const [entry, ...future] = history.future;
  if (entry === undefined) return null;
  return { entry, history: { past: [...history.past, entry], future } };
}

export function forget<T>(history: History<T>, entry: T): History<T> {
  return { past: history.past.filter((e) => e !== entry), future: history.future.filter((e) => e !== entry) };
}

export function returnToPast<T>(history: History<T>, entry: T): History<T> {
  return { past: [...history.past.filter((e) => e !== entry), entry], future: history.future.filter((e) => e !== entry) };
}

export function returnToFuture<T>(history: History<T>, entry: T): History<T> {
  return { past: history.past.filter((e) => e !== entry), future: [entry, ...history.future.filter((e) => e !== entry)] };
}

export const keepNewest = <T>(history: History<T>, count: number): History<T> => ({
  past: count > 0 ? history.past.slice(-count) : [],
  future: history.future.slice(0, Math.max(0, count - history.past.length)),
});

export const historySize = <T>(history: History<T>) => history.past.length + history.future.length;

export function changedFields<T extends object>(before: T, changes: Partial<T>): Partial<T> {
  const keys = Object.keys(changes) as (keyof T)[];
  return Object.fromEntries(keys.filter((key) => before[key] !== changes[key]).map((key) => [key, changes[key]])) as Partial<T>;
}

export function revertPatch<T extends object>(before: T, changes: Partial<T>): Partial<T> {
  const keys = Object.keys(changes) as (keyof T)[];
  return Object.fromEntries(keys.map((key) => [key, before[key] ?? null])) as Partial<T>;
}

export function groupPatches<P extends { id: string }>(patches: P[]): { ids: string[]; changes: Omit<P, "id"> }[] {
  const groups = new Map<string, { ids: string[]; changes: Omit<P, "id"> }>();
  for (const { id, ...changes } of patches) {
    const key = JSON.stringify(Object.entries(changes).sort(([a], [b]) => a.localeCompare(b)));
    const group = groups.get(key);
    if (group) group.ids.push(id);
    else groups.set(key, { ids: [id], changes });
  }
  return [...groups.values()];
}

const FIELD_UPDATED: Record<string, string> = {
  amount: "Monto actualizado",
  detail: "Detalle actualizado",
  date: "Fecha actualizada",
  card_id: "Tarjeta actualizada",
  type: "Tipo actualizado",
  reimbursement_for_category: "Reembolso actualizado",
};

const movements = (count: number, verb: string) => `${count} movimientos ${verb}`;

export function describeUpdate(changes: Record<string, unknown>, count: number): string {
  if (typeof changes.category_name === "string") {
    return `${count === 1 ? "Categoría" : `${count} movimientos`} → ${changes.category_name}`;
  }
  if (count > 1) return movements(count, "actualizados");
  const fields = Object.keys(changes).filter((key) => key !== "category_source");
  return (fields.length === 1 && FIELD_UPDATED[fields[0]]) || "Movimiento editado";
}

export const describeRemoval = (count: number) => (count === 1 ? "Movimiento borrado" : movements(count, "borrados"));

export const describeDuplicate = (count: number) => (count === 1 ? "Movimiento duplicado" : movements(count, "duplicados"));

export const describeUndone = (label: string) => `Deshecho: ${label}`;

export const describeMissing = (count: number) => (count === 1 ? "Ese movimiento ya no existe" : "Esos movimientos ya no existen");

export interface StoredRow {
  id: string;
  date: string;
  amount: number;
  type: string;
  category_name: string;
}

export type IdPatch = { id: string };

export type EditOperation<Row extends StoredRow = StoredRow, Patch extends IdPatch = IdPatch> =
  | { kind: "patch"; patches: Patch[] }
  | { kind: "remove"; rows: Row[] }
  | { kind: "restore"; rows: Row[] };

export interface EditEntry<Row extends StoredRow = StoredRow, Patch extends IdPatch = IdPatch> {
  label: string;
  undo: EditOperation<Row, Patch>;
  redo: EditOperation<Row, Patch>;
}

export const touchedIds = (operation: EditOperation) =>
  operation.kind === "patch" ? operation.patches.map((patch) => patch.id) : operation.rows.map((row) => row.id);

export function applicablePart<Row extends StoredRow, Patch extends IdPatch>(
  operation: EditOperation<Row, Patch>,
  exists: (id: string) => boolean,
): EditOperation<Row, Patch> | null {
  if (operation.kind === "patch") {
    const patches = operation.patches.filter((patch) => exists(patch.id));
    return patches.length > 0 ? { kind: "patch", patches } : null;
  }
  const rows = operation.rows.filter((row) => exists(row.id) === (operation.kind === "remove"));
  return rows.length > 0 ? { kind: operation.kind, rows } : null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isId = (value: unknown) => typeof value === "string" && value !== "";

const isIdPatch = (value: unknown): value is IdPatch => isRecord(value) && isId(value.id);

const isStoredRow = (value: unknown): value is StoredRow =>
  isRecord(value) && isId(value.id) &&
  typeof value.date === "string" && typeof value.amount === "number" &&
  typeof value.type === "string" && typeof value.category_name === "string";

const isNonEmptyListOf = <T>(value: unknown, isItem: (item: unknown) => item is T): value is T[] =>
  Array.isArray(value) && value.length > 0 && value.every(isItem);

function isEditOperation(value: unknown): value is EditOperation {
  if (!isRecord(value)) return false;
  if (value.kind === "patch") return isNonEmptyListOf(value.patches, isIdPatch);
  if (value.kind === "remove" || value.kind === "restore") return isNonEmptyListOf(value.rows, isStoredRow);
  return false;
}

export const isEditEntry = (value: unknown): value is EditEntry =>
  isRecord(value) && typeof value.label === "string" && value.label !== "" && isEditOperation(value.undo) && isEditOperation(value.redo);

const STORED_HISTORY_VERSION = 1;

export const historyStorageKey = (userId: string) => `rindo-edit-history:${userId}`;

export const serializeHistory = <T>(history: History<T>) =>
  JSON.stringify({ version: STORED_HISTORY_VERSION, past: history.past, future: history.future });

export function parseStoredHistory<T>(data: unknown, isEntry: (value: unknown) => value is T, limit = EDIT_HISTORY_LIMIT): History<T> | null {
  if (!isRecord(data) || data.version !== STORED_HISTORY_VERSION) return null;
  const { past, future } = data;
  if (!Array.isArray(past) || !Array.isArray(future) || !past.every(isEntry) || !future.every(isEntry)) return null;
  return keepNewest({ past, future }, limit);
}

export const isApplePlatform = (userAgent: string) => /Mac|iPhone|iPad|iPod/.test(userAgent);

export const undoShortcuts = (apple: boolean) =>
  apple ? { undo: "⌘Z", redo: "⇧⌘Z" } : { undo: "Ctrl+Z", redo: "Ctrl+Y" };
