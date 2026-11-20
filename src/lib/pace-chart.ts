import type { MonthPace, PaceVerdict } from "./month-pace.ts";

export type Point = [number, number];

export const linePath = (pts: Point[]) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

export const dayRange = (to: number) => Array.from({ length: to + 1 }, (_, d) => d);

export const MAX_DRIVERS = 4;

export function explainingDrivers(pace: MonthPace) {
  const floor = Math.max(3_000, pace.typicalSoFar * 0.02);
  return pace.drivers.filter((d) => Math.abs(d.delta) >= floor).slice(0, MAX_DRIVERS);
}

export function pacePhrase(isLive: boolean, verdict: PaceVerdict) {
  return isLive
    ? verdict === "under" ? "bajo tu ritmo" : verdict === "over" ? "sobre tu ritmo" : "en tu ritmo"
    : verdict === "under" ? "bajo tu mes típico" : verdict === "over" ? "sobre tu mes típico" : "igual que tu mes típico";
}

export function leftoverLabel(leftover: number, isLive: boolean) {
  return leftover >= 0 ? (isLive ? "Te sobran" : "Te sobró") : isLive ? "Te faltan" : "Te faltó";
}

export function typicalIncome(previous: number[]) {
  const earned = previous.filter((v) => v > 0).sort((a, b) => a - b);
  return earned.length ? earned[Math.floor(earned.length / 2)] : 0;
}
