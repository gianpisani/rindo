/**
 * La plata en el tiempo, mes a mes. Función pura y sin alias `@/` para poder
 * testearla con `node --test`: quien la usa le pasa cómo se calculan los
 * flujos de un mes y los baldes a una fecha (las mismas funciones del
 * inicio), así Finanzas y el inicio nunca cuentan distinto.
 */

export interface MonthFlows {
  /** Ingresos reales (sin reembolsos, con el sueldo atribuido al mes que financia). */
  ingreso: number;
  /** Gasto neto de reembolsos, sin plata en tránsito. */
  gasto: number;
  /** Aportes menos rescates: lo que se movió de lo líquido a lo invertido. */
  invertido: number;
}

export interface HistoryPoint extends MonthFlows {
  month: Date;
  /** Lo que sobró: ingreso − gasto − invertido. */
  quedo: number;
  /** Baldes al cierre del mes (o a hoy, si es el mes en curso). */
  liquido: number;
  invertidoAcumulado: number;
  patrimonio: number;
}

export const startOfMonthOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
export const endOfMonthOf = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

/** Los meses desde el primero con datos hasta `last`, a lo más `max` (los más recientes). */
export function monthsBetween(first: Date, last: Date, max = 36): Date[] {
  const months: Date[] = [];
  for (let m = startOfMonthOf(first); m <= last; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) months.push(m);
  return months.slice(-max);
}

export function buildHistory(
  months: Date[],
  flowsOf: (month: Date) => MonthFlows,
  bucketsAt: (end: Date) => { liquido: number; invertido: number }
): HistoryPoint[] {
  return months.map((month) => {
    const flows = flowsOf(month);
    const buckets = bucketsAt(endOfMonthOf(month));
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

/**
 * Promedios de los meses cerrados (el mes en curso está a medias y
 * arrastraría todo hacia abajo). Divide por meses calendario, no por meses
 * con movimientos: un mes sin ingresos también cuenta.
 */
export function historyAverages(points: HistoryPoint[], today: Date) {
  const current = startOfMonthOf(today).getTime();
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
    /** Qué parte de lo que entra no se gasta (se invierte o queda). */
    ahorro: ingreso > 0 ? (ingreso - gasto) / ingreso : null,
  };
}

export interface CategoryTrend {
  category: string;
  /** Gasto neto por mes, en el orden de `months`. */
  perMonth: number[];
  total: number;
  /** Promedio de los meses cerrados. */
  average: number;
}

/**
 * Las categorías que más pesan en el período, con su gasto de cada mes.
 * `spendOf` devuelve el gasto neto por categoría de un mes.
 */
export function categoryTrends(
  months: Date[],
  spendOf: (start: Date, end: Date) => Map<string, number>,
  today: Date,
  limit = 8
): CategoryTrend[] {
  const current = startOfMonthOf(today).getTime();
  const perMonth = months.map((m) => spendOf(startOfMonthOf(m), endOfMonthOf(m)));
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

/** $1,4M · $48k · $900: para encabezados donde el número exacto estorba. */
export const clpShort = (value: number) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000).toLocaleString("es-CL")}k`;
  return `${sign}$${Math.round(abs)}`;
};
