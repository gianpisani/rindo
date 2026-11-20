import { addMonths, getDate } from "date-fns";
import type { Transaction } from "@/hooks/useTransactions";
import {
  computeBuckets,
  DEFAULT_PASS_THROUGH_CATEGORIES,
  DEFAULT_TRANSIT_CATEGORIES,
  isCardPayment,
  type Buckets,
} from "@/lib/ledger";
import {
  dayOfPeriod,
  daysInPeriod,
  isInPeriod,
  periodStartOf,
} from "@/lib/period";

export { DEFAULT_TRANSIT_CATEGORIES };

export const SALARY_SHIFT_DAY = 25;

export const DEFAULT_SALARY_CATEGORIES = ["Sueldo"];

export const SWEEP_ALERT_THRESHOLD = 200_000;

export interface RealFlowsConfig {
  salaryShiftDay: number | null;
  salaryCategories: string[];
  transitCategories: string[];
  periodStartDay: number;
}

export const DEFAULT_FLOW_CONFIG: RealFlowsConfig = {
  salaryShiftDay: SALARY_SHIFT_DAY,
  salaryCategories: DEFAULT_SALARY_CATEGORIES,
  transitCategories: DEFAULT_TRANSIT_CATEGORIES,
  periodStartDay: 1,
};

export function resolveFlowConfig(
  partial?: Partial<RealFlowsConfig>
): RealFlowsConfig {
  return { ...DEFAULT_FLOW_CONFIG, ...partial };
}

export interface RealFlows {
  ingresoReal: number;
  reembolsosRecibidos: number;
  consumoBruto: number;
  consumoNeto: number;
  invertido: number;
  rescatado: number;
  rendimiento: number;
  dailyNet: number[];
}

export function attributionDate(
  t: Transaction,
  config: RealFlowsConfig = DEFAULT_FLOW_CONFIG
): Date {
  const date = new Date(t.date);
  if (
    config.salaryShiftDay !== null &&
    config.periodStartDay === 1 &&
    t.type === "Ingreso" &&
    !t.reimbursement_for_category &&
    config.salaryCategories.includes(t.category_name) &&
    getDate(date) >= config.salaryShiftDay
  ) {
    return addMonths(date, 1);
  }
  return date;
}

export function computeRealFlows(
  transactions: Transaction[],
  month: Date,
  partialConfig?: Partial<RealFlowsConfig>
): RealFlows {
  const config = resolveFlowConfig(partialConfig);
  const transit = new Set(config.transitCategories);
  const startDay = config.periodStartDay;
  const start = periodStartOf(month, startDay);
  const daysInMonth = daysInPeriod(start, startDay);
  const inMonth = (date: Date) => isInPeriod(date, start, startDay);

  let ingresoReal = 0;
  let reembolsosRecibidos = 0;
  let consumoBruto = 0;
  let invertido = 0;
  let rescatado = 0;
  let rendimiento = 0;
  const dailyNet = new Array(daysInMonth + 1).fill(0);

  for (const t of transactions) {
    if (isCardPayment(t)) continue;
    const date = new Date(t.date);
    const amount = Number(t.amount);

    if (t.type === "Ingreso") {
      if (t.reimbursement_for_category) {
        if (!inMonth(date)) continue;
        reembolsosRecibidos += amount;
        const day = dayOfPeriod(date, start);
        if (day >= 1 && day <= daysInMonth) dailyNet[day] -= amount;
      } else if (inMonth(attributionDate(t, config))) {
        ingresoReal += amount;
      }
      continue;
    }

    if (!inMonth(date)) continue;

    if (t.type === "Gasto") {
      if (transit.has(t.category_name)) continue;
      consumoBruto += amount;
      const day = dayOfPeriod(date, start);
      if (day >= 1 && day <= daysInMonth) dailyNet[day] += amount;
    } else if (t.type === "Inversión") {
      invertido += amount;
    } else if (t.type === "Rescate") {
      rescatado += amount;
    } else if (t.type === "Rendimiento") {
      rendimiento += amount;
    }
  }

  return {
    ingresoReal,
    reembolsosRecibidos,
    consumoBruto,
    consumoNeto: consumoBruto - reembolsosRecibidos,
    invertido,
    rescatado,
    rendimiento,
    dailyNet,
  };
}

export function computeLedger(
  transactions: Transaction[],
  passThroughCategories: string[] = DEFAULT_PASS_THROUGH_CATEGORIES
): Buckets {
  return computeBuckets(transactions, passThroughCategories);
}

export function computeRealBalance(
  transactions: Transaction[],
  passThroughCategories: string[] = DEFAULT_PASS_THROUGH_CATEGORIES
): number {
  return computeBuckets(transactions, passThroughCategories).liquido;
}
