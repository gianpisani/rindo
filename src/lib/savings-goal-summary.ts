import { format } from "date-fns";
import { es } from "date-fns/locale";
import { clp } from "./format.ts";
import { periodNameDate, shiftPeriod } from "./period.ts";
import type { SavingsMonth, Sweep } from "./savings-goal.ts";

export const SAVINGS_HISTORY_MONTHS = 12;
const GRACE_DAY = 5;

export type SavingsTone = "met" | "part" | "none" | "wait";

export interface SavingsNote {
  text: string;
  tone: SavingsTone;
}

const shortDay = (d: Date) => format(d, "d MMM", { locale: es }).replace(".", "");

export const periodMonthLabel = (month: Date, startDay: number, pattern: "MMMM" | "MMM") =>
  format(periodNameDate(month, startDay), pattern, { locale: es }).replace(".", "");

export function sweepDays(sweeps: Sweep[]) {
  const days = Array.from(new Set(sweeps.map((s) => shortDay(s.date))));
  if (days.length <= 1) return days.join("");
  return `${days.slice(0, -1).join(", ")} y ${days[days.length - 1]}`;
}

export function savingsTone(month: SavingsMonth, isCurrent: boolean, dayOfPeriod: number): SavingsTone {
  if (month.met) return "met";
  if (month.saved > 0) return "part";
  return isCurrent && dayOfPeriod <= GRACE_DAY ? "wait" : "none";
}

export const goalProgressPct = (saved: number, goal: number) =>
  goal > 0 ? Math.min(100, Math.round((saved / goal) * 100)) : 0;

export function savingsChartScale(goal: number, months: SavingsMonth[]) {
  const scale = Math.max(goal * 1.12, ...months.map((m) => m.saved * 1.04), 1);
  return { scale, goalFrac: goal > 0 ? goal / scale : 0 };
}

export function currentSavingsNote({
  current,
  currentTone,
  goal,
  nextSweeps,
  thisPeriod,
  startDay,
}: {
  current: SavingsMonth;
  currentTone: SavingsTone;
  goal: number;
  nextSweeps: Sweep[];
  thisPeriod: Date;
  startDay: number;
}): SavingsNote {
  const nextTotal = nextSweeps.reduce((s, x) => s + x.amount, 0);
  if (nextTotal > 0) {
    const nextMonthName = periodMonthLabel(shiftPeriod(thisPeriod, 1, startDay), startDay, "MMMM");
    return { text: `ya barriste ${clp(nextTotal)} para ${nextMonthName} ✓`, tone: "met" };
  }
  if (current.met) return { text: `cumplida ✓ · barrido el ${sweepDays(current.sweeps)}`, tone: "met" };
  if (current.saved > 0) {
    return { text: `barrido el ${sweepDays(current.sweeps)} · faltan ${clp(goal - current.saved)}`, tone: "part" };
  }
  if (currentTone === "wait") return { text: "todavía no barres nada este mes", tone: "wait" };
  return { text: "este mes no barriste nada", tone: "none" };
}

export function savingsMonthDetail(month: SavingsMonth, startDay: number) {
  const top = `${periodMonthLabel(month.month, startDay, "MMMM")} · ${clp(month.saved)}`;
  const parts: string[] = [];
  if (month.sweeps.length) parts.push(`barrido el ${sweepDays(month.sweeps)}`);
  if (month.rescued > 0) parts.push(`rescataste ${clp(month.rescued)}`);
  if (!month.met && month.biggestHit) {
    parts.push(`el golpe: ${month.biggestHit.label} ${clp(month.biggestHit.amount)}`);
  }
  if (!parts.length) parts.push(month.met ? "cumplida" : "sin movimientos a inversión");
  return { top, bottom: parts.join(" · ") };
}
