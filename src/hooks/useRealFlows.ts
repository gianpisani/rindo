import { useMemo } from "react";
import { addMonths, getDate } from "date-fns";
import type { Transaction } from "./useTransactions";
import {
  computeBuckets,
  DEFAULT_PASS_THROUGH_CATEGORIES,
  type Buckets,
} from "@/lib/ledger";
import {
  dayOfPeriod,
  daysInPeriod,
  isInPeriod,
  periodStartOf,
} from "@/lib/period";

export { DEFAULT_PASS_THROUGH_CATEGORIES };
export type { Buckets };

// ─── Configuración (defaults, todo parametrizable) ───────
// Ninguna de estas reglas es obligatoria: cada una se puede
// desactivar o ajustar por usuario vía `RealFlowsConfig`.

/** Día del mes desde el cual un ingreso recurrente se atribuye al mes siguiente (el que financia). */
export const SALARY_SHIFT_DAY = 25;

/** Categorías de ingreso que se consideran "sueldo" para la regla de atribución. */
export const DEFAULT_SALARY_CATEGORIES = ["Sueldo"];

/**
 * Categorías de gasto que son plata en tránsito (se pone por otros y vuelve,
 * o ajustes contables). Se excluyen de todo cálculo.
 */
export const DEFAULT_TRANSIT_CATEGORIES = ["Reembolsos", "Conciliación"];

/** Diferencia mínima entre ahorrado e invertido para avisar "cerraste el mes sin barrer". */
export const SWEEP_ALERT_THRESHOLD = 200_000;

export interface RealFlowsConfig {
  /** Día ≥ N atribuye el sueldo al mes siguiente. `null` desactiva la regla. */
  salaryShiftDay: number | null;
  /** Nombres de categoría de ingreso afectas al sueldo-shift. */
  salaryCategories: string[];
  /** Categorías de gasto en tránsito, excluidas de todo. */
  transitCategories: string[];
  /**
   * Día en que empieza el mes financiero (1 = calendario). Con un valor
   * distinto de 1 la regla del sueldo-shift se apaga: el corte ya la cubre.
   */
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
  /** Ingresos sin tag de reembolso, con sueldo-shift aplicado. */
  ingresoReal: number;
  /** Ingresos con `reimbursement_for_category` recibidos en el mes. */
  reembolsosRecibidos: number;
  /** Gastos del mes, sin tránsito. */
  consumoBruto: number;
  /** consumoBruto − reembolsosRecibidos. */
  consumoNeto: number;
  /** Aportes a inversiones del mes. */
  invertido: number;
  /** Plata rescatada de las inversiones en el mes (volvió a la liquidez). */
  rescatado: number;
  /** Lo que las inversiones ganaron (o perdieron) en el mes. */
  rendimiento: number;
  /** Gasto neto por día del periodo (índice 1..días; 0 sin uso). Para burn-down. */
  dailyNet: number[];
}

/**
 * Fecha de atribución de una transacción: a qué mes "pertenece".
 * Un sueldo que llega el día ≥ `salaryShiftDay` financia el mes siguiente.
 */
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

/**
 * Clasifica los flujos reales de un mes financiero (`month` = cualquier fecha
 * dentro del periodo; con `periodStartDay = 1` es el mes calendario).
 * Función pura (sin hooks) para poder testearla y computar rangos de meses.
 */
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

/**
 * Los dos baldes del patrimonio (líquido / invertido) de todo el historial.
 * La matemática vive en `@/lib/ledger`: acá solo se ata a las transacciones.
 */
export function computeLedger(
  transactions: Transaction[],
  passThroughCategories: string[] = DEFAULT_PASS_THROUGH_CATEGORIES
): Buckets {
  return computeBuckets(transactions, passThroughCategories);
}

/**
 * Balance líquido histórico: lo que puedo gastar hoy. Ingresos − gastos −
 * aportes + rescates, excluyendo el tránsito puro en ambas direcciones (el
 * gasto puesto por otros y su devolución tagueada). Las categorías de ajuste
 * (p.ej. Conciliación) SÍ cuentan: existen para corregir el balance.
 */
export function computeRealBalance(
  transactions: Transaction[],
  passThroughCategories: string[] = DEFAULT_PASS_THROUGH_CATEGORIES
): number {
  return computeBuckets(transactions, passThroughCategories).liquido;
}

/** Hook de conveniencia: flujos reales del mes, memoizados. */
export function useRealFlows(
  transactions: Transaction[],
  month: Date,
  partialConfig?: Partial<RealFlowsConfig>
): RealFlows {
  return useMemo(
    () => computeRealFlows(transactions, month, partialConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, month.getTime(), JSON.stringify(partialConfig)]
  );
}
