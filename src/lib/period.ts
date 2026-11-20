/**
 * El "mes financiero": un periodo mensual que empieza el día `startDay` y
 * termina el día anterior al siguiente inicio (15 nov – 14 dic). Con
 * `startDay = 1` es exactamente el mes calendario.
 *
 * Un periodo se representa por la fecha local de su inicio (medianoche) y se
 * nombra por el mes en que termina: el 15 nov – 14 dic es "diciembre". Si el mes no tiene el día `startDay`
 * (31 en febrero), el inicio se ajusta al último día de ese mes.
 *
 * Función pura, sin alias `@/`, para poder testearla con `node --test`.
 */

export const DEFAULT_PERIOD_START_DAY = 1;

const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** Normaliza a un entero 1..31 (cualquier valor inválido → 1). */
export function normalizeStartDay(startDay: number | null | undefined): number {
  const n = Math.trunc(Number(startDay));
  return Number.isFinite(n) && n >= 1 && n <= 31 ? n : DEFAULT_PERIOD_START_DAY;
}

/** Inicio del periodo que nombra el mes `m` (0-11) del año `y`. */
export function periodStartFor(y: number, m: number, startDay: number): Date {
  const first = new Date(y, m, 1);
  const fy = first.getFullYear();
  const fm = first.getMonth();
  return new Date(fy, fm, Math.min(normalizeStartDay(startDay), daysInMonth(fy, fm)));
}

/** Inicio del periodo que contiene `date`. */
export function periodStartOf(date: Date, startDay: number): Date {
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = periodStartFor(y, m, startDay);
  return date.getTime() >= start.getTime() ? start : periodStartFor(y, m - 1, startDay);
}

/** El periodo `delta` periodos después (o antes) del que empieza en `start`. */
export function shiftPeriod(start: Date, delta: number, startDay: number): Date {
  return periodStartFor(start.getFullYear(), start.getMonth() + delta, startDay);
}

/** Último instante del periodo (23:59:59.999 del día anterior al siguiente inicio). */
export function periodEndOf(start: Date, startDay: number): Date {
  return new Date(shiftPeriod(start, 1, startDay).getTime() - 1);
}

export function isInPeriod(date: Date, start: Date, startDay: number): boolean {
  const t = date.getTime();
  return t >= start.getTime() && t < shiftPeriod(start, 1, startDay).getTime();
}

/** Índice correlativo del periodo (año*12 + mes que lo nombra). */
export const periodIndex = (start: Date) => start.getFullYear() * 12 + start.getMonth();

/** "yyyy-MM" del mes en que empieza el periodo. Identificador interno, no es su nombre. */
export const periodKey = (start: Date) =>
  `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

const dayNumber = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;

/** Cuántos días tiene el periodo. */
export function daysInPeriod(start: Date, startDay: number): number {
  return dayNumber(shiftPeriod(start, 1, startDay)) - dayNumber(start);
}

/** Día 1-based de `date` dentro del periodo que empieza en `start`. */
export function dayOfPeriod(date: Date, start: Date): number {
  return dayNumber(date) - dayNumber(start) + 1;
}

/** Los periodos desde el que contiene `first` hasta el que contiene `last`, a lo más `max` (los más recientes). */
export function periodsBetween(first: Date, last: Date, startDay: number, max = 36): Date[] {
  const out: Date[] = [];
  const end = periodStartOf(last, startDay).getTime();
  for (let p = periodStartOf(first, startDay); p.getTime() <= end; p = shiftPeriod(p, 1, startDay)) out.push(p);
  return out.slice(-max);
}

/** Día en que termina un periodo que empieza el `startDay` (0 = último día del mes). */
export const periodEndDay = (startDay: number) => normalizeStartDay(startDay) - 1;

/** Día de inicio a partir del día de término (0 o 31 = fin de mes → inicio 1). */
export const startDayFromEndDay = (endDay: number) => (endDay <= 0 || endDay >= 31 ? 1 : endDay + 1);

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const shortDate = (d: Date) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;

/** "15 nov – 14 dic". */
export function periodRangeLabel(start: Date, startDay: number): string {
  return `${shortDate(start)} – ${shortDate(periodEndOf(start, startDay))}`;
}

/**
 * Una fecha dentro del mes que da nombre al periodo (el día en que termina),
 * para formatearla con "MMMM yyyy". Con `startDay = 1` es el mismo mes.
 */
export function periodNameDate(start: Date, startDay: number): Date {
  const end = periodEndOf(start, startDay);
  return new Date(end.getFullYear(), end.getMonth(), end.getDate());
}

/** "diciembre" para el 15 nov – 14 dic (el mes en que termina). */
export const periodMonthName = (start: Date, startDay: number) =>
  MONTHS_LONG[periodNameDate(start, startDay).getMonth()];

/** Etiqueta corta para menús: "Calendario" o "15 → 14". */
export const periodShortLabel = (startDay: number) =>
  normalizeStartDay(startDay) === 1 ? "Calendario" : `${startDay} → ${periodEndDay(startDay)}`;
