import { periodKey, periodStartOf, shiftPeriod } from "./period.ts";
import { DEFAULT_TRANSIT_CATEGORIES, isCardPayment } from "./ledger.ts";

export const SAVINGS_SHIFT_DAY = 25;

const TRANSIT_CATEGORIES = new Set(DEFAULT_TRANSIT_CATEGORIES);

export interface SavingsEntry {
  type: string;
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
  month: Date;
  key: string;
  saved: number;
  invested: number;
  rescued: number;
  met: boolean;
  sweeps: Sweep[];
  biggestHit: { label: string; amount: number } | null;
}

const monthKey = periodKey;

export function savingsMonthOf(entry: SavingsEntry, startDay = 1): Date | null {
  const date = new Date(entry.date);
  const period = periodStartOf(date, startDay);
  if (entry.type === "Inversión") {
    return startDay === 1 && date.getDate() >= SAVINGS_SHIFT_DAY
      ? shiftPeriod(period, 1, startDay)
      : period;
  }
  if (entry.type === "Rescate") return period;
  return null;
}

export function computeSavingsMonths(
  entries: SavingsEntry[],
  goal: number,
  endMonth: Date,
  count = 12,
  startDay = 1
): SavingsMonth[] {
  const end = periodStartOf(endMonth, startDay);
  const months: SavingsMonth[] = [];
  const byKey = new Map<string, SavingsMonth>();
  for (let i = count - 1; i >= 0; i--) {
    const month = shiftPeriod(end, -i, startDay);
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
      if (isCardPayment(entry)) continue;
      const row = byKey.get(monthKey(periodStartOf(new Date(entry.date), startDay)));
      if (!row) continue;
      if (!row.biggestHit || amount > row.biggestHit.amount) {
        const label = (entry.detail || "").trim() || entry.category_name || "Gasto";
        row.biggestHit = { label, amount };
      }
      continue;
    }

    const target = savingsMonthOf(entry, startDay);
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

export function computeNextMonthSweep(entries: SavingsEntry[], now: Date, startDay = 1): Sweep[] {
  const nextKey = monthKey(shiftPeriod(periodStartOf(now, startDay), 1, startDay));
  return entries
    .filter((e) => e.type === "Inversión")
    .filter((e) => {
      const target = savingsMonthOf(e, startDay);
      return target !== null && monthKey(target) === nextKey;
    })
    .map((e) => ({ date: new Date(e.date), amount: Number(e.amount) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
