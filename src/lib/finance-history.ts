import { periodEndOf, periodsBetween, periodStartOf } from "./period.ts";

export interface MonthFlows {
  ingreso: number;
  gasto: number;
  invertido: number;
}

export interface HistoryPoint extends MonthFlows {
  month: Date;
  quedo: number;
  liquido: number;
  invertidoAcumulado: number;
  patrimonio: number;
}

export const startOfMonthOf = (date: Date, startDay = 1) => periodStartOf(date, startDay);
export const endOfMonthOf = (month: Date, startDay = 1) => periodEndOf(periodStartOf(month, startDay), startDay);

export function monthsBetween(first: Date, last: Date, max = 36, startDay = 1): Date[] {
  return periodsBetween(first, last, startDay, max);
}

export function buildHistory(
  months: Date[],
  flowsOf: (month: Date) => MonthFlows,
  bucketsAt: (end: Date) => { liquido: number; invertido: number },
  startDay = 1
): HistoryPoint[] {
  return months.map((month) => {
    const flows = flowsOf(month);
    const buckets = bucketsAt(endOfMonthOf(month, startDay));
    return {
      month,
      ...flows,
      quedo: flows.ingreso - flows.gasto - flows.invertido,
      liquido: buckets.liquido,
      invertidoAcumulado: buckets.invertido,
      patrimonio: buckets.liquido + buckets.invertido,
    };
  });
}

export function historyAverages(points: HistoryPoint[], today: Date, startDay = 1) {
  const current = startOfMonthOf(today, startDay).getTime();
  const closed = points.filter((p) => p.month.getTime() < current);
  const n = closed.length;
  const sum = (pick: (p: HistoryPoint) => number) => closed.reduce((s, p) => s + pick(p), 0);
  const ingreso = n ? sum((p) => p.ingreso) / n : 0;
  const gasto = n ? sum((p) => p.gasto) / n : 0;
  const quedo = n ? sum((p) => p.quedo) / n : 0;
  const invertido = n ? sum((p) => p.invertido) / n : 0;
  return {
    months: n,
    ingreso,
    gasto,
    quedo,
    invertido,
    ahorro: ingreso > 0 ? (ingreso - gasto) / ingreso : null,
  };
}

export interface CategoryTrend {
  category: string;
  perMonth: number[];
  total: number;
  average: number;
}

export function categoryTrends(
  months: Date[],
  spendOf: (start: Date, end: Date) => Map<string, number>,
  today: Date,
  limit = 8,
  startDay = 1
): CategoryTrend[] {
  const current = startOfMonthOf(today, startDay).getTime();
  const perMonth = months.map((m) => spendOf(startOfMonthOf(m, startDay), endOfMonthOf(m, startDay)));
  const categories = new Set(perMonth.flatMap((map) => [...map.keys()]));
  const closedIdx = months.map((m, i) => (m.getTime() < current ? i : -1)).filter((i) => i >= 0);
  return [...categories]
    .map((category) => {
      const series = perMonth.map((map) => map.get(category) ?? 0);
      const closedSum = closedIdx.reduce((s, i) => s + series[i], 0);
      return {
        category,
        perMonth: series,
        total: series.reduce((s, v) => s + v, 0),
        average: closedIdx.length ? closedSum / closedIdx.length : 0,
      };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export const clpShort = (value: number) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000).toLocaleString("es-CL")}k`;
  return `${sign}$${Math.round(abs)}`;
};
