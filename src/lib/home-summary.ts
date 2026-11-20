import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { ANALYZING_CATEGORY } from "./auto-category-policy.ts";
import { DEFAULT_TRANSIT_CATEGORIES, isCardPayment } from "./ledger.ts";
import { clp } from "./format.ts";

interface DatedEntry {
  type: string;
  date: string;
  amount: number;
  category_name: string;
  reimbursement_for_category?: string | null;
}

interface CategoryPeriodRow {
  effectiveAmount: number;
  reimbursedAmount: number;
  count: number;
}

export interface CategorySpend {
  category: string;
  effectiveAmount: number;
}

const transit = new Set(DEFAULT_TRANSIT_CATEGORIES);

export const sinceLabel = (iso: string, now = Date.now()) => {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 60 * 24) return `hace ${Math.round(minutes / 60)} h`;
  return `hace ${Math.round(minutes / 1440)} d`;
};

export const greetingFor = (hour: number) => {
  if (hour < 12) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
};

export function withoutTransit<V>(spend: Map<string, V>) {
  for (const key of [...spend.keys()]) if (transit.has(key)) spend.delete(key);
  return spend;
}

export function rankCategorySpend(spend: Map<string, CategoryPeriodRow>): CategorySpend[] {
  return [...spend.entries()]
    .filter(([category, c]) => category !== ANALYZING_CATEGORY && c.count > 0)
    .map(([category, c]) => ({ category, effectiveAmount: c.effectiveAmount }))
    .sort((a, b) => b.effectiveAmount - a.effectiveAmount);
}

export const totalSpend = (spend: Iterable<{ effectiveAmount: number }>) =>
  [...spend].reduce((s, c) => s + c.effectiveAmount, 0);

export const percentOf = (amount: number, total: number) => (total > 0 ? Math.round((amount / total) * 100) : 0);

export function categoryPeriodRows<T extends DatedEntry>(entries: T[], category: string, start: Date, end: Date) {
  return entries.filter((t) => {
    const d = new Date(t.date);
    if (d < start || d > end) return false;
    return (t.type === "Gasto" && t.category_name === category) || t.reimbursement_for_category === category;
  });
}

export function categorySummary(row: CategoryPeriodRow | undefined) {
  const count = row?.count ?? 0;
  return `${clp(row?.effectiveAmount ?? 0)} · ${count} movimiento${count === 1 ? "" : "s"}${row && row.reimbursedAmount > 0 ? ` · ${clp(row.reimbursedAmount)} reembolsado` : ""}`;
}

export function groupByDay<T extends { date: string }>(entries: T[]) {
  return entries.reduce((acc, t) => {
    const key = format(new Date(t.date), "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, T[]>);
}

export const newestDayFirst = (dayKeys: string[]) =>
  dayKeys.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

export const daySpend = (entries: DatedEntry[]) =>
  entries.reduce((sum, t) => sum + (t.type === "Gasto" && !isCardPayment(t) ? Number(t.amount) : 0), 0);

export const dayLabel = (dayKey: string) => {
  const d = new Date(dayKey + "T12:00:00");
  if (isToday(d)) return "Hoy";
  if (isYesterday(d)) return "Ayer";
  return format(d, "d MMM", { locale: es });
};
