/**
 * La Meta: ahorrar $X al mes. Una sola pregunta, mes a mes: ¿la cumpliste?
 *
 * "Ahorrado" es lo que de verdad se movió a inversión (menos rescates), no
 * un derivado de ingreso − gasto. Es la única cifra que el usuario decide
 * con la mano, así que es la única que puede medir la meta.
 *
 * Un aporte hecho el día ≥ 25 financia el mes SIGUIENTE, igual que el
 * sueldo: el barrido del 29 de agosto es el ahorro de septiembre. Un
 * rescate cuenta en el mes en que ocurre (vuelve a la liquidez de ese mes).
 *
 * Sin dependencias del resto de la app para poder correr en node:test.
 */

export const SAVINGS_SHIFT_DAY = 25;

/** Categorías de gasto que son plata en tránsito, no consumo propio. */
const TRANSIT_CATEGORIES = new Set(["Reembolsos", "Conciliación"]);

export interface SavingsEntry {
  type: string;
  /** ISO timestamp (TIMESTAMPTZ en zona Chile). */
  date: string;
  amount: number | string;
  category_name?: string | null;
  detail?: string | null;
}

export interface Sweep {
  date: Date;
  amount: number;
}

export interface SavingsMonth {
  /** Primer día del mes, en hora local. */
  month: Date;
  /** "yyyy-MM", para keys y comparaciones. */
  key: string;
  /** Aportes atribuidos al mes − rescates del mes. Nunca negativo en la UI. */
  saved: number;
  invested: number;
  rescued: number;
  met: boolean;
  /** Los aportes que financian este mes, en orden cronológico. */
  sweeps: Sweep[];
  /** El gasto más grande del mes calendario (sin tránsito). */
  biggestHit: { label: string; amount: number } | null;
}

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

const addMonths = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth() + n, 1);

/**
 * A qué mes pertenece un aporte: el que financia. Día ≥ 25 → mes siguiente.
 * Devuelve null si la transacción no mueve ahorro.
 */
export function savingsMonthOf(entry: SavingsEntry): Date | null {
  const date = new Date(entry.date);
  if (entry.type === "Inversión") {
    return date.getDate() >= SAVINGS_SHIFT_DAY
      ? addMonths(date, 1)
      : startOfMonth(date);
  }
  if (entry.type === "Rescate") return startOfMonth(date);
  return null;
}

/**
 * Los últimos `count` meses terminando en `endMonth` (incluido), del más
 * antiguo al más reciente.
 */
export function computeSavingsMonths(
  entries: SavingsEntry[],
  goal: number,
  endMonth: Date,
  count = 12
): SavingsMonth[] {
  const end = startOfMonth(endMonth);
  const months: SavingsMonth[] = [];
  const byKey = new Map<string, SavingsMonth>();
  for (let i = count - 1; i >= 0; i--) {
    const month = addMonths(end, -i);
    const row: SavingsMonth = {
      month,
      key: monthKey(month),
      saved: 0,
      invested: 0,
      rescued: 0,
      met: false,
      sweeps: [],
      biggestHit: null,
    };
    months.push(row);
    byKey.set(row.key, row);
  }

  for (const entry of entries) {
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount)) continue;

    if (entry.type === "Gasto") {
      if (entry.category_name && TRANSIT_CATEGORIES.has(entry.category_name)) continue;
      const row = byKey.get(monthKey(new Date(entry.date)));
      if (!row) continue;
      if (!row.biggestHit || amount > row.biggestHit.amount) {
        const label = (entry.detail || "").trim() || entry.category_name || "Gasto";
        row.biggestHit = { label, amount };
      }
      continue;
    }

    const target = savingsMonthOf(entry);
    if (!target) continue;
    const row = byKey.get(monthKey(target));
    if (!row) continue;
    if (entry.type === "Inversión") {
      row.invested += amount;
      row.sweeps.push({ date: new Date(entry.date), amount });
    } else {
      row.rescued += amount;
    }
  }

  for (const row of months) {
    row.sweeps.sort((a, b) => a.date.getTime() - b.date.getTime());
    row.saved = Math.max(0, row.invested - row.rescued);
    row.met = goal > 0 && row.saved >= goal;
  }
  return months;
}

/**
 * Lo ya barrido para el mes que viene (aportes de este mes con día ≥ 25).
 * Sirve para no dejar al usuario mirando "$0" recién después de invertir.
 */
export function computeNextMonthSweep(entries: SavingsEntry[], now: Date): Sweep[] {
  const nextKey = monthKey(addMonths(now, 1));
  return entries
    .filter((e) => e.type === "Inversión")
    .filter((e) => {
      const target = savingsMonthOf(e);
      return target !== null && monthKey(target) === nextKey;
    })
    .map((e) => ({ date: new Date(e.date), amount: Number(e.amount) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
