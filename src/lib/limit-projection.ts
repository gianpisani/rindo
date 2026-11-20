import { isCardPayment } from "./ledger.ts";
import { dayOfPeriod, periodIndex, periodStartOf } from "./period.ts";

const LOOKBACK_PERIODS = 3;

interface ProjectionEntry {
  type: string;
  date: string;
  amount: number | string;
  category_name: string;
  reimbursement_for_category?: string | null;
}

export function typicalRemainingSpend(
  entries: ProjectionEntry[],
  thisPeriod: Date,
  todayInPeriod: number,
  startDay: number,
): Map<string, number> {
  const sums = new Map<string, number>();
  for (const t of entries) {
    if (t.type !== "Gasto" && !t.reimbursement_for_category) continue;
    if (isCardPayment(t)) continue;
    const d = new Date(t.date);
    const start = periodStartOf(d, startDay);
    const periodsAgo = periodIndex(thisPeriod) - periodIndex(start);
    if (periodsAgo < 1 || periodsAgo > LOOKBACK_PERIODS || dayOfPeriod(d, start) <= todayInPeriod) continue;
    const category = t.type === "Gasto" ? t.category_name : (t.reimbursement_for_category as string);
    const signed = t.type === "Gasto" ? Number(t.amount) : -Number(t.amount);
    sums.set(category, (sums.get(category) ?? 0) + signed);
  }
  return new Map([...sums].map(([category, sum]) => [category, Math.max(0, sum / LOOKBACK_PERIODS)]));
}

export function limitProjection(
  row: { state: string; spent: number; limit: number },
  remaining: number,
): number | null {
  if (row.state === "over" || remaining <= 0) return null;
  return ((row.spent + remaining) / row.limit) * 100;
}
