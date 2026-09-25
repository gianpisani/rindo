/**
 * El ritmo del mes: cuánto llevas gastado hoy contra lo que tu yo de los
 * últimos meses llevaba gastado al mismo día (tu "mes típico").
 *
 * No compara contra un presupuesto (eso vive en /budget), compara contra ti:
 * por eso puede mejorar o empeorar día a día. Función pura, sin alias `@/`,
 * para poder testearla con `node --test`.
 */

export interface PaceEntry {
  type: string;
  date: string;
  amount: number;
  category_name: string;
  reimbursement_for_category?: string | null;
}

export interface PaceDriver {
  category: string;
  /** Gasto neto acumulado de la categoría hasta el día de corte. */
  me: number;
  /** Mediana de lo que llevabas en esa categoría al mismo día. */
  typical: number;
  delta: number;
}

export interface MonthPace {
  daysInMonth: number;
  /** Día de corte: hoy si el mes está en curso, el último si ya cerró. */
  asOfDay: number;
  isLive: boolean;
  /** Gasto neto acumulado por día (índice 0..daysInMonth, 0 = antes de empezar). */
  me: number[];
  /** Tu mes típico acumulado: mediana y banda p25–p75 (null sin historia). */
  typical: { median: number[]; low: number[]; high: number[] } | null;
  /** Cuántos meses pasados forman el mes típico. */
  typicalMonths: number;
  spentSoFar: number;
  typicalSoFar: number;
  /** spentSoFar − typicalSoFar: negativo = vas bajo tu ritmo. */
  delta: number;
  typicalTotal: number;
  /** Lo que llevas + lo que sueles gastar de acá a fin de mes. */
  projectedTotal: number;
  drivers: PaceDriver[];
}

export const PACE_LOOKBACK_MONTHS = 6;
export const DEFAULT_PACE_TRANSIT = ["Reembolsos", "Conciliación"];

const monthKey = (y: number, m: number) => y * 12 + m;
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** Gasto neto por categoría y día de cada mes: key(mes) → categoría → [0..días]. */
function dailyByCategory(entries: PaceEntry[], transit: Set<string>) {
  const months = new Map<number, Map<string, number[]>>();
  for (const e of entries) {
    const expense = e.type === "Gasto" && !transit.has(e.category_name);
    const refund =
      (e.type === "Ingreso" || e.type === "Reembolso") && !!e.reimbursement_for_category;
    if (!expense && !refund) continue;
    const d = new Date(e.date);
    if (!Number.isFinite(d.getTime())) continue;
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = monthKey(y, m);
    const category = expense ? e.category_name : e.reimbursement_for_category!;
    let cats = months.get(key);
    if (!cats) months.set(key, (cats = new Map()));
    let days = cats.get(category);
    if (!days) cats.set(category, (days = new Array(daysIn(y, m) + 1).fill(0)));
    days[d.getDate()] += expense ? Number(e.amount) : -Number(e.amount);
  }
  return months;
}

function cumulative(daily: number[]) {
  const out = new Array(daily.length).fill(0);
  for (let i = 1; i < daily.length; i++) out[i] = out[i - 1] + daily[i];
  return out;
}

function quantile(values: number[], q: number) {
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** Lleva el día `d` de un mes de `days` días al día equivalente de otro de `len`. */
const scaleDay = (d: number, days: number, len: number) =>
  Math.min(len, Math.round((d * len) / days));

export function computeMonthPace(
  entries: PaceEntry[],
  month: Date,
  options: { today?: Date; lookback?: number; transit?: string[] } = {}
): MonthPace {
  const today = options.today ?? new Date();
  const lookback = options.lookback ?? PACE_LOOKBACK_MONTHS;
  const transit = new Set(options.transit ?? DEFAULT_PACE_TRANSIT);
  const y = month.getFullYear();
  const m = month.getMonth();
  const days = daysIn(y, m);
  const key = monthKey(y, m);
  const todayKey = monthKey(today.getFullYear(), today.getMonth());
  const isLive = key === todayKey;
  const asOfDay = isLive ? today.getDate() : days;

  const byMonth = dailyByCategory(entries, transit);

  const totalDaily = (cats: Map<string, number[]> | undefined, len: number) => {
    const out = new Array(len + 1).fill(0);
    cats?.forEach((arr) => arr.forEach((v, i) => (out[i] += v)));
    return out;
  };

  const current = byMonth.get(key);
  const me = cumulative(totalDaily(current, days));

  // Meses pasados con gasto: forman el mes típico.
  const past: Array<{ len: number; cum: number[]; cats: Map<string, number[]> }> = [];
  for (let back = 1; back <= lookback; back++) {
    const pk = key - back;
    const cats = byMonth.get(pk);
    if (!cats) continue;
    const py = Math.floor(pk / 12);
    const pm = pk % 12;
    const len = daysIn(py, pm);
    const cum = cumulative(totalDaily(cats, len));
    if (cum[len] <= 0) continue;
    past.push({ len, cum, cats });
  }

  let typical: MonthPace["typical"] = null;
  if (past.length > 0) {
    const median: number[] = [];
    const low: number[] = [];
    const high: number[] = [];
    for (let d = 0; d <= days; d++) {
      const vals = past.map((p) => p.cum[scaleDay(d, days, p.len)]);
      median.push(quantile(vals, 0.5));
      low.push(quantile(vals, past.length >= 3 ? 0.25 : 0));
      high.push(quantile(vals, past.length >= 3 ? 0.75 : 1));
    }
    typical = { median, low, high };
  }

  const spentSoFar = me[asOfDay];
  const typicalSoFar = typical ? typical.median[asOfDay] : 0;
  const typicalTotal = typical ? typical.median[days] : 0;
  const projectedTotal = isLive && typical
    ? spentSoFar + Math.max(0, typicalTotal - typicalSoFar)
    : spentSoFar;

  // Qué categorías explican la diferencia contra tu mes típico.
  const drivers: PaceDriver[] = [];
  if (past.length > 0) {
    const names = new Set<string>(current ? [...current.keys()] : []);
    past.forEach((p) => p.cats.forEach((_, c) => names.add(c)));
    for (const category of names) {
      const mine = current?.get(category);
      const meCat = mine ? cumulative(mine)[asOfDay] : 0;
      const typicalCat = quantile(
        past.map((p) => {
          const arr = p.cats.get(category);
          return arr ? cumulative(arr)[scaleDay(asOfDay, days, p.len)] : 0;
        }),
        0.5
      );
      const delta = meCat - typicalCat;
      if (Math.abs(delta) < 1) continue;
      drivers.push({ category, me: meCat, typical: typicalCat, delta });
    }
    drivers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }

  return {
    daysInMonth: days,
    asOfDay,
    isLive,
    me,
    typical,
    typicalMonths: past.length,
    spentSoFar,
    typicalSoFar,
    delta: spentSoFar - typicalSoFar,
    typicalTotal,
    projectedTotal,
    drivers,
  };
}

export type PaceVerdict = "under" | "even" | "over";

/** ±5% del típico a la fecha cuenta como "en tu ritmo". */
export function paceVerdict(pace: MonthPace): PaceVerdict {
  if (!pace.typical) return "even";
  const band = Math.max(5_000, pace.typicalSoFar * 0.05);
  if (pace.delta < -band) return "under";
  if (pace.delta > band) return "over";
  return "even";
}
