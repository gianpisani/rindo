import { bucketDeltas, DEFAULT_PASS_THROUGH_CATEGORIES } from "@/lib/ledger";
import type { Transaction } from "@/hooks/useTransactions";
import type { Spec, Dimension } from "./model";

export interface NamedColor {
  id?: string;
  name: string;
  color: string | null;
}
export interface Point {
  key: string;
  label: string;
  value: number;
  ids: string[];
  series: Record<string, number>;
  seriesIds: Record<string, string[]>;
}
export interface Result {
  points: Point[];
  total: number | null;
  ids: string[];
  series: string[];
  from: string;
  to: string;
  error?: string;
}
const chileDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function dateKey(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const p = chileDate.formatToParts(date);
  return `${p.find((x) => x.type === "year")?.value}-${p.find((x) => x.type === "month")?.value}-${p.find((x) => x.type === "day")?.value}`;
}
const monthName = (key: string) =>
  new Intl.DateTimeFormat("es-CL", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${key}-15T12:00:00Z`));
function plusMonth(key: string, delta: number) {
  const d = new Date(`${key}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}
export function bounds(s: Spec, ts: Transaction[], now = new Date()) {
  const today = dateKey(now),
    current = today.slice(0, 7);
  let from = ts.reduce((a, t) => {
    const d = dateKey(t.date);
    return d && d < a ? d : a;
  }, today);
  let to = today;
  if (s.periodo === "año") from = `${today.slice(0, 4)}-01-01`;
  if (s.periodo === "mes") from = `${current}-01`;
  if (s.periodo === "12meses") from = `${plusMonth(current, -11)}-01`;
  if (s.periodo === "rango") {
    from = s.fechaDesde || `${s.desde}-01`;
    const d = new Date(`${plusMonth(s.hasta, 1)}-01T12:00:00Z`);
    d.setUTCDate(0);
    to = [today, s.fechaHasta || d.toISOString().slice(0, 10)].sort()[0];
  }
  return { from, to };
}
function group(
  dim: Dimension,
  date: string,
  category: string,
  type: string,
  card: string,
  detail = "Sin detalle",
): [string, string] {
  if (dim === "detalle") return [detail, detail];
  if (dim === "categoria") return [category, category];
  if (dim === "tipo") return [type, type];
  if (dim === "tarjeta") return [card, card];
  if (dim === "año") return [date.slice(0, 4), date.slice(0, 4)];
  if (dim === "trimestre") {
    const k = `${date.slice(0, 4)} T${Math.ceil(Number(date.slice(5, 7)) / 3)}`;
    return [k, k];
  }
  if (dim === "semana") {
    const n = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    return [
      String(n),
      [
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
        "Domingo",
      ][n],
    ];
  }
  return [date.slice(0, 7), monthName(date.slice(0, 7))];
}
export function run(
  s: Spec,
  ts: Transaction[],
  cards: NamedColor[] = [],
  now = new Date(),
): Result {
  const { from, to } = bounds(s, ts, now);
  const empty: Result = {
    points: [],
    total: null,
    ids: [],
    series: [],
    from,
    to,
  };
  if (from > to)
    return {
      ...empty,
      error:
        "La fecha inicial debe ser anterior a la final y no estar en el futuro.",
    };
  const map = new Map<string, Point>();
  const counts = new Map<string, Record<string, number>>();
  let income = 0,
    expenses = 0,
    amount = 0,
    count = 0,
    opening = 0;
  const ids: string[] = [];
  const seen = new Set<string>();
  const derived = ["ahorro", "diario", "patrimonio"].includes(s.medida);
  for (const t of ts) {
    const date = dateKey(t.date);
    if (!date || date > to) continue;
    if (s.medida === "patrimonio" && date < from) {
      const d = bucketDeltas(t);
      opening += d.liquido + d.invertido;
      continue;
    }
    if (date < from) continue;
    if (s.tarjetas.length && !s.tarjetas.includes(t.card_id || "sin-tarjeta"))
      continue;
    let type: string = t.type,
      category = t.category_name,
      value = Number(t.amount);
    if (!Number.isFinite(value)) continue;
    if (s.medida === "patrimonio") {
      const d = bucketDeltas(t);
      value = d.liquido + d.invertido;
    } else if (s.neto && s.medida !== "cantidad") {
      if (
        (t.type === "Gasto" &&
          DEFAULT_PASS_THROUGH_CATEGORIES.includes(category)) ||
        t.type === "Reembolso"
      )
        continue;
      if (t.type === "Ingreso" && t.reimbursement_for_category) {
        if (
          DEFAULT_PASS_THROUGH_CATEGORIES.includes(t.reimbursement_for_category)
        )
          continue;
        type = "Gasto";
        category = t.reimbursement_for_category;
        value = -value;
      }
    }
    if (!derived && s.tipo !== "todos" && type !== s.tipo) continue;
    if (s.medida === "diario" && type !== "Gasto") continue;
    if (s.medida === "ahorro" && type !== "Ingreso" && type !== "Gasto")
      continue;
    if (
      s.medida !== "patrimonio" &&
      s.categorias.length &&
      !s.categorias.includes(category)
    )
      continue;
    if (type === "Ingreso") income += value;
    if (type === "Gasto") expenses += value;
    ids.push(t.id);
    count++;
    amount += value;
    const card = cards.find((c) => c.id === t.card_id)?.name || "Sin tarjeta";
    const [key, label] = group(
      s.agrupar,
      date,
      category,
      type,
      card,
      t.detail || "Sin detalle",
    );
    const series =
      s.series === "ninguna"
        ? "Total"
        : group(
            s.series,
            date,
            category,
            type,
            card,
            t.detail || "Sin detalle",
          )[0];
    seen.add(series);
    if (!map.has(key))
      map.set(key, {
        key,
        label,
        value: 0,
        ids: [],
        series: Object.create(null),
        seriesIds: Object.create(null),
      });
    const p = map.get(key)!;
    const n = s.medida === "cantidad" ? 1 : value;
    p.value += n;
    p.ids.push(t.id);
    p.series[series] = (p.series[series] || 0) + n;
    (p.seriesIds[series] ||= []).push(t.id);
    const c = counts.get(key) || Object.create(null);
    c[series] = (c[series] || 0) + 1;
    counts.set(key, c);
  }
  // Include quiet months in the range; otherwise trends suggest missing months never happened.
  if (["mes", "año", "trimestre"].includes(s.agrupar)) {
    let cursor = from.slice(0, 7),
      guard = 0;
    while (cursor <= to.slice(0, 7) && guard++ < 2400) {
      const [key, label] = group(s.agrupar, `${cursor}-01`, "", "", "");
      if (!map.has(key))
        map.set(key, {
          key,
          label,
          value: 0,
          ids: [],
          series: Object.create(null),
          seriesIds: Object.create(null),
        });
      cursor = plusMonth(cursor, 1);
    }
  }
  if (s.agrupar === "semana")
    for (let i = 0; i < 7; i++) {
      const key = String(i);
      if (!map.has(key))
        map.set(key, {
          key,
          label: [
            "Lunes",
            "Martes",
            "Miércoles",
            "Jueves",
            "Viernes",
            "Sábado",
            "Domingo",
          ][i],
          value: 0,
          ids: [],
          series: Object.create(null),
          seriesIds: Object.create(null),
        });
    }
  let points = [...map.values()];
  if (["mes", "año", "trimestre", "semana"].includes(s.agrupar))
    points.sort((a, b) => a.key.localeCompare(b.key));
  else points.sort((a, b) => b.value - a.value);
  if (s.medida === "promedio")
    points = points.map((p) => ({
      ...p,
      value: p.ids.length ? p.value / p.ids.length : 0,
      series: Object.fromEntries(
        Object.entries(p.series).map(([k, v]) => [
          k,
          v / (counts.get(p.key)?.[k] || 1),
        ]),
      ),
    }));
  if (s.medida === "patrimonio") {
    let cumulative = opening;
    const cumulativeIds: string[] = ts
      .filter((t) => dateKey(t.date) < from)
      .map((t) => t.id);
    points = points.map((p) => {
      cumulative += p.value;
      cumulativeIds.push(...p.ids);
      return {
        ...p,
        value: cumulative,
        ids: [...cumulativeIds],
        series: { Total: cumulative },
        seriesIds: { Total: [...cumulativeIds] },
      };
    });
  }
  const days =
    Math.round(
      (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
        86400000,
    ) + 1;
  const total =
    s.medida === "cantidad"
      ? count
      : s.medida === "promedio"
        ? count
          ? amount / count
          : null
        : s.medida === "ahorro"
          ? income > 0
            ? ((income - expenses) / income) * 100
            : null
          : s.medida === "diario"
            ? expenses / days
            : s.medida === "patrimonio"
              ? opening + amount
              : amount;
  return {
    points,
    total,
    ids:
      s.medida === "patrimonio"
        ? [...ts.filter((t) => dateKey(t.date) < from).map((t) => t.id), ...ids]
        : ids,
    series: [...seen],
    from,
    to,
  };
}
export function formatValue(
  n: number | null,
  measure: Spec["medida"],
  compact = false,
) {
  if (n === null) return "—";
  return new Intl.NumberFormat("es-CL", {
    ...(measure === "cantidad"
      ? {}
      : measure === "ahorro"
        ? { style: "unit", unit: "percent" }
        : { style: "currency", currency: "CLP" }),
    maximumFractionDigits: measure === "ahorro" || compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(n);
}
