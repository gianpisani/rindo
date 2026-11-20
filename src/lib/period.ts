export const DEFAULT_PERIOD_START_DAY = 1;

const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

export function normalizeStartDay(startDay: number | null | undefined): number {
  const n = Math.trunc(Number(startDay));
  return Number.isFinite(n) && n >= 1 && n <= 31 ? n : DEFAULT_PERIOD_START_DAY;
}

export function periodStartFor(y: number, m: number, startDay: number): Date {
  const first = new Date(y, m, 1);
  const fy = first.getFullYear();
  const fm = first.getMonth();
  return new Date(fy, fm, Math.min(normalizeStartDay(startDay), daysInMonth(fy, fm)));
}

export function periodStartOf(date: Date, startDay: number): Date {
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = periodStartFor(y, m, startDay);
  return date.getTime() >= start.getTime() ? start : periodStartFor(y, m - 1, startDay);
}

export function shiftPeriod(start: Date, delta: number, startDay: number): Date {
  return periodStartFor(start.getFullYear(), start.getMonth() + delta, startDay);
}

export function periodEndOf(start: Date, startDay: number): Date {
  return new Date(shiftPeriod(start, 1, startDay).getTime() - 1);
}

export function isInPeriod(date: Date, start: Date, startDay: number): boolean {
  const t = date.getTime();
  return t >= start.getTime() && t < shiftPeriod(start, 1, startDay).getTime();
}

export const periodIndex = (start: Date) => start.getFullYear() * 12 + start.getMonth();

export const periodKey = (start: Date) =>
  `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

const dayNumber = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;

export function daysInPeriod(start: Date, startDay: number): number {
  return dayNumber(shiftPeriod(start, 1, startDay)) - dayNumber(start);
}

export function dayOfPeriod(date: Date, start: Date): number {
  return dayNumber(date) - dayNumber(start) + 1;
}

export function periodsBetween(first: Date, last: Date, startDay: number, max = 36): Date[] {
  const out: Date[] = [];
  const end = periodStartOf(last, startDay).getTime();
  for (let p = periodStartOf(first, startDay); p.getTime() <= end; p = shiftPeriod(p, 1, startDay)) out.push(p);
  return out.slice(-max);
}

export const periodEndDay = (startDay: number) => normalizeStartDay(startDay) - 1;

export const startDayFromEndDay = (endDay: number) => (endDay <= 0 || endDay >= 31 ? 1 : endDay + 1);

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const shortDate = (d: Date) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;

export function periodRangeLabel(start: Date, startDay: number): string {
  return `${shortDate(start)} – ${shortDate(periodEndOf(start, startDay))}`;
}

export function periodNameDate(start: Date, startDay: number): Date {
  const end = periodEndOf(start, startDay);
  return new Date(end.getFullYear(), end.getMonth(), end.getDate());
}

export const periodMonthName = (start: Date, startDay: number) =>
  MONTHS_LONG[periodNameDate(start, startDay).getMonth()];

export const periodShortLabel = (startDay: number) =>
  normalizeStartDay(startDay) === 1 ? "Calendario" : `${startDay} → ${periodEndDay(startDay)}`;
