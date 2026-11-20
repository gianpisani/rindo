import { isCardPayment } from "./ledger.ts";

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
  start: Date;
  end: Date;
}

const dayOfMonth = (year: number, month: number, d: number, hour = 0) =>
  new Date(year, month, Math.min(d, new Date(year, month + 1, 0).getDate()), hour);

const addMonthsClamped = (date: Date, n: number, billingDay: number) =>
  dayOfMonth(date.getFullYear(), date.getMonth() + n, billingDay, date.getHours());

export function billingCycle(billingDay: number, offset = 0, now = new Date()): Cycle {
  const thisMonth = dayOfMonth(now.getFullYear(), now.getMonth(), billingDay, BILLING_CUTOFF_HOUR);
  const nextClose = now < thisMonth ? thisMonth : addMonthsClamped(thisMonth, 1, billingDay);
  const end = addMonthsClamped(nextClose, offset, billingDay);
  return { start: addMonthsClamped(end, -1, billingDay), end };
}

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

export function paidBetween(entries: CycleEntry[], cardId: string, from: Date, to: Date): number {
  const payments = entries.filter((t) => t.card_id === cardId && isCardPayment(t) && inRange(t, from, to));
  const expenseSide = payments.filter((t) => t.type === "Gasto");
  const side = expenseSide.length > 0 ? expenseSide : payments.filter((t) => t.type === "Ingreso");
  return side.reduce((sum, t) => sum + Number(t.amount), 0);
}

export interface CardStatus {
  porFacturar: number;
  closes: Date;
  aPagar: number;
  payDate: Date;
  showAPagar: boolean;
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
