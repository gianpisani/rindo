/**
 * Los ciclos de una tarjeta de crédito y lo que se debe en cada uno.
 *
 * Cada compra con tarjeta es un Gasto el día de la compra (vinculado por
 * `card_id`, cuotas incluidas: cada cuota es su propio Gasto). El pago de la
 * tarjeta es un "Pago de tarjeta", que no es gasto: acá solo sirve para
 * descontar lo ya pagado del estado de cuenta cerrado.
 *
 * Función pura, sin alias `@/`, para poder testearla con `node --test`.
 */

import { isCardPayment } from "./ledger.ts";

// Banco de Chile: el ciclo corre de 14:00 a 14:00 del día de cierre.
export const BILLING_CUTOFF_HOUR = 14;

export interface CycleEntry {
  id?: string;
  type: string;
  date: string;
  amount: number;
  category_name: string;
  card_id?: string | null;
  reimbursement_for_category?: string | null;
}

export interface Cycle {
  /** Cierre anterior (incluido). */
  start: Date;
  /** Cierre de este ciclo (excluido). */
  end: Date;
}

/** El día `d` del mes, o el último si el mes es más corto (un 31 en febrero es el 28). */
const dayOfMonth = (year: number, month: number, d: number, hour = 0) =>
  new Date(year, month, Math.min(d, new Date(year, month + 1, 0).getDate()), hour);

/** Mismo día del mes `n` meses después, acotado al largo del mes. */
const addMonthsClamped = (date: Date, n: number, billingDay: number) =>
  dayOfMonth(date.getFullYear(), date.getMonth() + n, billingDay, date.getHours());

/**
 * El ciclo de facturación: 0 = el que está corriendo (cierra en el próximo
 * cierre), −1 = el último cerrado, y así.
 */
export function billingCycle(billingDay: number, offset = 0, now = new Date()): Cycle {
  const thisMonth = dayOfMonth(now.getFullYear(), now.getMonth(), billingDay, BILLING_CUTOFF_HOUR);
  const nextClose = now < thisMonth ? thisMonth : addMonthsClamped(thisMonth, 1, billingDay);
  const end = addMonthsClamped(nextClose, offset, billingDay);
  return { start: addMonthsClamped(end, -1, billingDay), end };
}

/** El primer día de pago después del cierre del ciclo. */
export function paymentDate(cycle: Cycle, paymentDay: number): Date {
  const sameMonth = dayOfMonth(cycle.end.getFullYear(), cycle.end.getMonth(), paymentDay);
  return sameMonth > cycle.end
    ? sameMonth
    : dayOfMonth(cycle.end.getFullYear(), cycle.end.getMonth() + 1, paymentDay);
}

const inRange = (entry: CycleEntry, from: Date, to: Date) => {
  const at = new Date(entry.date).getTime();
  return at >= from.getTime() && at < to.getTime();
};

/**
 * El estado de cuenta de un ciclo: los movimientos de la tarjeta, del más
 * nuevo al más viejo, y su total. El total son las compras menos los abonos
 * que no son pagos (devoluciones); los pagos se listan pero no suman.
 */
export function cycleStatement<T extends CycleEntry>(entries: T[], cardId: string, cycle: Cycle) {
  const txs = entries
    .filter((t) => t.card_id === cardId && inRange(t, cycle.start, cycle.end))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const total = txs.reduce((sum, t) => {
    if (isCardPayment(t)) return sum;
    if (t.type === "Gasto") return sum + Number(t.amount);
    if (t.type === "Ingreso") return sum - Number(t.amount);
    return sum;
  }, 0);
  return { txs, total };
}

/**
 * Lo pagado a una tarjeta entre `from` y `to`. bank-sync trae los dos lados
 * del mismo pago (el cargo en la cuenta corriente y el abono en la tarjeta):
 * se cuenta uno solo, el Gasto si existe, para no restar el pago dos veces.
 */
export function paidBetween(entries: CycleEntry[], cardId: string, from: Date, to: Date): number {
  const payments = entries.filter((t) => t.card_id === cardId && isCardPayment(t) && inRange(t, from, to));
  const expenseSide = payments.filter((t) => t.type === "Gasto");
  const side = expenseSide.length > 0 ? expenseSide : payments.filter((t) => t.type === "Ingreso");
  return side.reduce((sum, t) => sum + Number(t.amount), 0);
}

export interface CardStatus {
  /** Compras desde el último cierre hasta hoy, cuotas de este ciclo incluidas. */
  porFacturar: number;
  /** Cuándo cierra el ciclo en curso. */
  closes: Date;
  /** El estado de cuenta cerrado menos lo ya pagado (puede ser ≤ 0). */
  aPagar: number;
  /** El día de pago del estado de cuenta cerrado. */
  payDate: Date;
  /** Hay algo por pagar y el día de pago no pasa: se muestra "A pagar". */
  showAPagar: boolean;
  /** La próxima fecha de pago: la del cerrado mientras no pase, si no la del ciclo en curso. */
  nextPay: Date;
}

export function cardStatus(
  entries: CycleEntry[],
  card: { id: string; billing_day: number; payment_day: number },
  now = new Date()
): CardStatus {
  const current = billingCycle(card.billing_day, 0, now);
  const closed = billingCycle(card.billing_day, -1, now);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const porFacturar = cycleStatement(entries, card.id, current).total;
  const billed = cycleStatement(entries, card.id, closed).total;
  // Lo pagado después del cierre, hasta hoy (lo que haya entrado a la base).
  const paid = paidBetween(entries, card.id, closed.end, new Date(8.64e15));
  const aPagar = billed - paid;
  const payDate = paymentDate(closed, card.payment_day);
  const beforeDue = payDate >= today;

  return {
    porFacturar,
    closes: current.end,
    aPagar,
    payDate,
    showAPagar: beforeDue && aPagar > 0,
    nextPay: beforeDue ? payDate : paymentDate(current, card.payment_day),
  };
}

/**
 * La deuda conocida de las tarjetas: lo por facturar más lo que queda por
 * pagar del estado cerrado. Es lo que separa el saldo del banco del líquido.
 */
export function cardsDebt(
  entries: CycleEntry[],
  cards: { id: string; billing_day: number; payment_day: number }[],
  now = new Date()
): number {
  return cards.reduce((sum, card) => {
    const status = cardStatus(entries, card, now);
    return sum + Math.max(0, status.porFacturar) + (status.showAPagar ? status.aPagar : 0);
  }, 0);
}
