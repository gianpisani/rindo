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
  return (fields.length === 1 && FIELD_UPDATED[fields[0]]) || "Movimiento actualizado";
}

export const describeRemoval = (count: number) => (count === 1 ? "Movimiento borrado" : movements(count, "borrados"));

export const describeDuplicate = (count: number) => (count === 1 ? "Movimiento duplicado" : movements(count, "duplicados"));
