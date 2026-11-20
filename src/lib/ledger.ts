/**
 * El ledger de dos baldes.
 *
 * Toda la plata vive en uno de dos baldes: lo **líquido** (lo que puedo gastar
 * hoy) y lo **invertido** (lo que está trabajando afuera). El patrimonio es la
 * suma de los dos. Cada tipo de transacción es un movimiento entre baldes, o
 * plata que entra/sale del sistema completo:
 *
 *   tipo          líquido   invertido   patrimonio
 *   Ingreso          +          ·           +
 *   Gasto            −          ·           −
 *   Inversión        −          +           =      aporte: cambia de balde
 *   Rescate          +          −           =      vuelta: cambia de balde
 *   Rendimiento      ·          ±           ±      lo que ganó (o perdió) solo
 *   Reembolso        ·          ·           ·      tránsito (ver abajo)
 *   Pago de tarjeta  ·          ·           ·      la compra ya restó (ver abajo)
 *
 * Las dos filas que cambian de balde no crean ni destruyen patrimonio: por eso
 * un rescate NO es un ingreso y un aporte NO es un gasto, y ninguno de los dos
 * debe ensuciar los flujos del mes.
 *
 * `Rendimiento` es el único tipo que admite monto negativo: un mes malo es un
 * dato, no un error de tipeo.
 */

import {
  CARD_PAYMENT_CATEGORY,
  CARD_PAYMENT_ICON,
  isCardPaymentCategory,
} from "../../supabase/functions/_shared/card-payment.ts";

export { CARD_PAYMENT_CATEGORY, CARD_PAYMENT_ICON, isCardPaymentCategory };

export type TransactionType =
  | "Ingreso"
  | "Gasto"
  | "Inversión"
  | "Reembolso"
  | "Rescate"
  | "Rendimiento";

/** Todos los tipos, en el orden en que se muestran en los selectores. */
export const TRANSACTION_TYPES: readonly TransactionType[] = [
  "Ingreso",
  "Gasto",
  "Inversión",
  "Rescate",
  "Rendimiento",
  "Reembolso",
] as const;

/** Los tres tipos que tocan el balde invertido. */
export const INVESTMENT_TYPES: readonly TransactionType[] = [
  "Inversión",
  "Rescate",
  "Rendimiento",
] as const;

/**
 * Tipos que admiten monto negativo. El resto está acotado a >= 0 por la
 * constraint `transactions_amount_check` en la base.
 */
export const SIGNED_TYPES: readonly TransactionType[] = ["Rendimiento"] as const;

export function allowsNegativeAmount(type: TransactionType): boolean {
  return SIGNED_TYPES.includes(type);
}

/**
 * Categorías de gasto que son plata puesta por otros y que VUELVE
 * (tagueada como reembolso). Se excluyen del balance en ambas direcciones.
 */
export const DEFAULT_PASS_THROUGH_CATEGORIES = ["Reembolsos"];

/**
 * Categorías de gasto que no son consumo propio: plata en tránsito (se pone
 * por otros y vuelve) o ajustes contables. Fuera del gasto del mes, del ritmo
 * y de "Por categoría". Conciliación sí mueve el líquido: corrige el balance.
 */
export const DEFAULT_TRANSIT_CATEGORIES = ["Reembolsos", "Conciliación"];

/**
 * El pago de la tarjeta de crédito. Cada compra con tarjeta ya es un Gasto el
 * día en que se hizo; pagar la tarjeta solo mueve plata de la cuenta a la
 * deuda. Por eso queda fuera de TODO, en cualquier tipo y dirección: gasto e
 * ingreso del mes, por categoría, límites, ritmo, historial y líquido. El
 * líquido, entonces, es la liquidez real: lo que tengo menos lo que debo en
 * la tarjeta. Reconoce también las categorías que algunos crearon a mano
 * ("Pago Tarjeta"): ver `isCardPaymentCategory`.
 */
export function isCardPayment(entry: {
  category_name?: string | null;
  reimbursement_for_category?: string | null;
}): boolean {
  return (
    isCardPaymentCategory(entry.category_name) ||
    isCardPaymentCategory(entry.reimbursement_for_category)
  );
}

/** Lo mínimo que necesita el ledger de una transacción para clasificarla. */
export interface LedgerEntry {
  type: TransactionType;
  amount: number;
  category_name: string;
  reimbursement_for_category?: string | null;
}

export interface Buckets {
  /** Lo que puedo gastar hoy: ingresos − gastos − aportes + rescates. */
  liquido: number;
  /** Lo que está trabajando: aportes − rescates + rendimientos. */
  invertido: number;
  /** liquido + invertido. Equivale a ingresos − gastos + rendimientos. */
  patrimonio: number;
}

/**
 * Plata en tránsito puro: el gasto que puse por otros y su devolución
 * tagueada, y el pago de la tarjeta (sus compras ya restaron). No es mío en
 * ninguna dirección, así que no entra a ningún balde.
 * Las categorías de ajuste (p.ej. Conciliación) SÍ cuentan: existen para
 * corregir el balance.
 */
function isPassThrough(entry: LedgerEntry, passThrough: Set<string>): boolean {
  if (isCardPayment(entry)) return true;
  if (entry.type === "Gasto") return passThrough.has(entry.category_name);
  if (entry.type === "Ingreso") {
    return Boolean(
      entry.reimbursement_for_category &&
        passThrough.has(entry.reimbursement_for_category)
    );
  }
  return false;
}

/** Cuánto mueve una transacción cada balde. Fuente única de la verdad. */
export function bucketDeltas(
  entry: LedgerEntry,
  passThroughCategories: string[] = DEFAULT_PASS_THROUGH_CATEGORIES
): { liquido: number; invertido: number } {
  const amount = Number(entry.amount);
  if (isPassThrough(entry, new Set(passThroughCategories))) {
    return { liquido: 0, invertido: 0 };
  }
  switch (entry.type) {
    case "Ingreso":
      return { liquido: amount, invertido: 0 };
    case "Gasto":
      return { liquido: -amount, invertido: 0 };
    case "Inversión":
      return { liquido: -amount, invertido: amount };
    case "Rescate":
      return { liquido: amount, invertido: -amount };
    case "Rendimiento":
      return { liquido: 0, invertido: amount };
    case "Reembolso":
    default:
      return { liquido: 0, invertido: 0 };
  }
}

/** Los dos baldes y el patrimonio, de todo el historial que le pases. */
export function computeBuckets(
  entries: LedgerEntry[],
  passThroughCategories: string[] = DEFAULT_PASS_THROUGH_CATEGORIES
): Buckets {
  const passThrough = new Set(passThroughCategories);
  let liquido = 0;
  let invertido = 0;
  for (const entry of entries) {
    if (isPassThrough(entry, passThrough)) continue;
    const delta = bucketDeltas(entry, passThroughCategories);
    liquido += delta.liquido;
    invertido += delta.invertido;
  }
  return { liquido, invertido, patrimonio: liquido + invertido };
}

/**
 * Signo con que se muestra un monto en listas y sumas: lo que sale de lo
 * líquido se ve en negativo. El rendimiento ya trae el signo en el monto.
 */
export function displaySign(type: TransactionType): -1 | 1 {
  return type === "Gasto" || type === "Inversión" ? -1 : 1;
}

/** Prefijo de signo para mostrar un monto (el negativo lo pone el formato). */
export function signPrefix(type: TransactionType, amount: number): string {
  if (type === "Rendimiento") return amount > 0 ? "+" : amount < 0 ? "−" : "";
  if (type === "Ingreso" || type === "Rescate") return "+";
  if (type === "Gasto" || type === "Inversión") return "−";
  return "";
}
