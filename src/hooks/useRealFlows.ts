import { useMemo } from "react";
import { addMonths, getDate, getDaysInMonth, isSameMonth } from "date-fns";
import type { Transaction } from "./useTransactions";

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
  /** Categorías de gasto tratadas como "bombazos" (gastos grandes no recurrentes). */
  splurgeCategories: string[];
}

export const DEFAULT_FLOW_CONFIG: RealFlowsConfig = {
  salaryShiftDay: SALARY_SHIFT_DAY,
  salaryCategories: DEFAULT_SALARY_CATEGORIES,
  transitCategories: DEFAULT_TRANSIT_CATEGORIES,
  splurgeCategories: [],
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
  /** Consumo neto de categorías NO bombazo. */
  vida: number;
  /** Consumo bruto en categorías bombazo. */
  bombazos: number;
  /** Inversiones del mes. */
  invertido: number;
  /** Gasto neto por día (índice 1..daysInMonth; 0 sin uso). Para burn-down. */
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
 * Clasifica los flujos reales de un mes calendario.
 * Función pura (sin hooks) para poder testearla y computar rangos de meses.
 */
export function computeRealFlows(
  transactions: Transaction[],
  month: Date,
  partialConfig?: Partial<RealFlowsConfig>
): RealFlows {
  const config = resolveFlowConfig(partialConfig);
  const transit = new Set(config.transitCategories);
  const splurge = new Set(config.splurgeCategories);
  const daysInMonth = getDaysInMonth(month);

  let ingresoReal = 0;
  let reembolsosRecibidos = 0;
  let consumoBruto = 0;
  let vida = 0;
  let bombazos = 0;
  let invertido = 0;
  const dailyNet = new Array(daysInMonth + 1).fill(0);

  for (const t of transactions) {
    const date = new Date(t.date);
    const amount = Number(t.amount);

    if (t.type === "Ingreso") {
      if (t.reimbursement_for_category) {
        if (!isSameMonth(date, month)) continue;
        reembolsosRecibidos += amount;
        const day = date.getDate();
        if (day >= 1 && day <= daysInMonth) dailyNet[day] -= amount;
      } else if (isSameMonth(attributionDate(t, config), month)) {
        ingresoReal += amount;
      }
      continue;
    }

    if (!isSameMonth(date, month)) continue;

    if (t.type === "Gasto") {
      if (transit.has(t.category_name)) continue;
      consumoBruto += amount;
      if (splurge.has(t.category_name)) bombazos += amount;
      else vida += amount;
      const day = date.getDate();
      if (day >= 1 && day <= daysInMonth) dailyNet[day] += amount;
    } else if (t.type === "Inversión") {
      invertido += amount;
    }
  }

  // Los reembolsos netean contra el mes en que llegan. Se restan de "vida"
  // salvo que vengan tagueados a una categoría bombazo.
  let reembolsosBombazo = 0;
  for (const t of transactions) {
    if (
      t.type === "Ingreso" &&
      t.reimbursement_for_category &&
      splurge.has(t.reimbursement_for_category) &&
      isSameMonth(new Date(t.date), month)
    ) {
      reembolsosBombazo += Number(t.amount);
    }
  }
  const reembolsosVida = reembolsosRecibidos - reembolsosBombazo;
  vida -= reembolsosVida;
  bombazos -= reembolsosBombazo;

  return {
    ingresoReal,
    reembolsosRecibidos,
    consumoBruto,
    consumoNeto: consumoBruto - reembolsosRecibidos,
    vida,
    bombazos,
    invertido,
    dailyNet,
  };
}

/**
 * Categorías de gasto que son plata puesta por otros y que VUELVE
 * (tagueada como reembolso). Se excluyen del balance en ambas direcciones.
 */
export const DEFAULT_PASS_THROUGH_CATEGORIES = ["Reembolsos"];

/**
 * Balance histórico real: ingresos − gastos − inversiones, excluyendo el
 * tránsito puro en ambas direcciones (el gasto puesto por otros y su
 * devolución tagueada). Las categorías de ajuste (p.ej. Conciliación)
 * SÍ cuentan: existen para corregir el balance.
 */
export function computeRealBalance(
  transactions: Transaction[],
  passThroughCategories: string[] = DEFAULT_PASS_THROUGH_CATEGORIES
): number {
  const passThrough = new Set(passThroughCategories);
  return transactions.reduce((acc, t) => {
    const amount = Number(t.amount);
    if (t.type === "Ingreso") {
      if (
        t.reimbursement_for_category &&
        passThrough.has(t.reimbursement_for_category)
      ) {
        return acc; // devolución de plata en tránsito
      }
      return acc + amount;
    }
    if (t.type === "Gasto") {
      if (passThrough.has(t.category_name)) return acc; // tránsito puro
      return acc - amount;
    }
    if (t.type === "Inversión") return acc - amount;
    return acc;
  }, 0);
}

/**
 * Fondo acumulable para bombazos: Σ (aporte mensual − bombazos del mes)
 * desde `fundStart` hasta `upTo` inclusive.
 */
export function computeSplurgeFund(
  transactions: Transaction[],
  fundMonthly: number,
  fundStart: Date,
  upTo: Date,
  partialConfig?: Partial<RealFlowsConfig>
): number {
  let fund = 0;
  let cursor = new Date(fundStart.getFullYear(), fundStart.getMonth(), 1);
  const end = new Date(upTo.getFullYear(), upTo.getMonth(), 1);
  while (cursor <= end) {
    const { bombazos } = computeRealFlows(transactions, cursor, partialConfig);
    fund += fundMonthly - bombazos;
    cursor = addMonths(cursor, 1);
  }
  return fund;
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
    [transactions, month.getFullYear(), month.getMonth(), JSON.stringify(partialConfig)]
  );
}
