import assert from 'node:assert/strict';
import { test } from 'node:test';
import { billingCycle, cardStatus, cardsDebt, cycleStatement, paidBetween, paymentDate } from '../src/lib/card-cycle.ts';
import { installmentsOverview, labeledCycle, withoutEmoji } from '../src/lib/card-view.ts';
import { shortDay, shortMonthYear } from '../src/lib/format.ts';

// Tarjeta que cierra el 20 y se paga el 5.
const card = { id: 'c1', billing_day: 20, payment_day: 5 };
const now = new Date(2026, 10, 25, 12); // 25 nov 2026

const gasto = (date: string, amount: number, over: Record<string, unknown> = {}) =>
  ({ type: 'Gasto', date, amount, category_name: 'Comida', card_id: 'c1', ...over });
const pago = (date: string, amount: number, type = 'Gasto') =>
  ({ type, date, amount, category_name: 'Pago de tarjeta', card_id: 'c1' });

test('el ciclo corre de cierre a cierre a las 14:00', () => {
  const current = billingCycle(20, 0, now);
  assert.deepEqual(current.start, new Date(2026, 10, 20, 14));
  assert.deepEqual(current.end, new Date(2026, 11, 20, 14));
  const closed = billingCycle(20, -1, now);
  assert.deepEqual(closed.start, new Date(2026, 9, 20, 14));
  assert.deepEqual(closed.end, new Date(2026, 10, 20, 14));
  // Antes de las 14:00 del día de cierre el ciclo sigue abierto.
  assert.deepEqual(billingCycle(20, 0, new Date(2026, 10, 20, 9)).end, new Date(2026, 10, 20, 14));
});

test('un cierre el 31 cae el último día de los meses cortos y vuelve al 31', () => {
  const feb = billingCycle(31, 0, new Date(2026, 1, 10));
  assert.deepEqual(feb.end, new Date(2026, 1, 28, 14));
  assert.deepEqual(billingCycle(31, 1, new Date(2026, 1, 10)).end, new Date(2026, 2, 31, 14));
});

test('el día de pago es el primero después del cierre', () => {
  assert.deepEqual(paymentDate(billingCycle(20, -1, now), 5), new Date(2026, 11, 5));
  assert.deepEqual(paymentDate(billingCycle(5, -1, now), 25), new Date(2026, 10, 25));
});

test('el estado de cuenta suma compras y devoluciones, no los pagos', () => {
  const { txs, total } = cycleStatement([
    gasto('2026-11-01T12:00:00', 100_000),
    gasto('2026-11-02T12:00:00', 10_000, { type: 'Ingreso', category_name: 'Devolución' }),
    pago('2026-11-03T12:00:00', 500_000),
    gasto('2026-11-04T12:00:00', 7_000, { card_id: 'otra' }),
  ], 'c1', billingCycle(20, -1, now));
  assert.equal(txs.length, 3);
  assert.equal(total, 90_000);
});

test('"Por facturar" son las compras desde el último cierre, cuotas incluidas; "A pagar" el ciclo cerrado menos lo pagado', () => {
  const entries = [
    gasto('2026-10-25T12:00:00', 600_000), // ciclo cerrado
    gasto('2026-11-10T12:00:00', 548_231), // ciclo cerrado
    gasto('2026-11-21T12:00:00', 30_000), // este ciclo
    gasto('2026-11-22T12:00:00', 20_000, { detail: 'TV - Cuota 2/6' }), // cuota de este ciclo
    pago('2026-11-23T12:00:00', 148_231), // pago parcial después del cierre
  ];
  const status = cardStatus(entries, card, now);
  assert.equal(status.porFacturar, 50_000);
  assert.deepEqual(status.closes, new Date(2026, 11, 20, 14));
  assert.equal(status.aPagar, 1_000_000);
  assert.deepEqual(status.payDate, new Date(2026, 11, 5));
  assert.equal(status.showAPagar, true);
  assert.equal(cardsDebt(entries, [card], now), 1_050_000);
});

test('bank-sync trae los dos lados del pago: se resta uno solo, el Gasto', () => {
  const entries = [
    gasto('2026-11-10T12:00:00', 300_000),
    pago('2026-11-22T12:00:00', 100_000, 'Gasto'),
    pago('2026-11-23T12:00:00', 100_000, 'Ingreso'),
  ];
  assert.equal(paidBetween(entries, 'c1', new Date(2026, 10, 20, 14), new Date(2027, 0, 1)), 100_000);
  assert.equal(cardStatus(entries, card, now).aPagar, 200_000);
  // Sin el Gasto, cuenta el abono.
  assert.equal(cardStatus(entries.filter((e) => e.type !== 'Gasto' || e.category_name !== 'Pago de tarjeta'), card, now).aPagar, 200_000);
});

test('"A pagar" no se muestra si ya se pagó todo o si pasó el día de pago', () => {
  const entries = [gasto('2026-11-10T12:00:00', 300_000), pago('2026-11-22T12:00:00', 300_000)];
  assert.equal(cardStatus(entries, card, now).showAPagar, false);
  const unpaid = [gasto('2026-11-10T12:00:00', 300_000)];
  const late = cardStatus(unpaid, card, new Date(2026, 11, 6, 12));
  assert.equal(late.showAPagar, false);
  assert.deepEqual(late.nextPay, new Date(2027, 0, 5));
  // El mismo día de pago todavía se muestra.
  assert.equal(cardStatus(unpaid, card, new Date(2026, 11, 5, 18)).showAPagar, true);
});

test('el ciclo etiquetado lleva el mes del cierre', () => {
  const cycle = labeledCycle(20, -1, now);
  assert.deepEqual(cycle.end, new Date(2026, 10, 20, 14));
  assert.equal(cycle.label, 'noviembre 2026');
  assert.equal(shortDay(cycle.end), '20 nov');
  assert.equal(shortMonthYear(new Date(2027, 2, 1)), 'mar 2027');
});

test('el detalle del estado de cuenta va sin emojis', () => {
  assert.equal(withoutEmoji('🍕 Pizza  ❤️ casa'), 'Pizza casa');
});

test('las cuotas activas van primero y suman el pago mensual', () => {
  const plan = (id: string, first: string, total: number, amount: number) =>
    ({ id, first_installment_date: first, total_installments: total, installment_amount: amount });
  const { rows, monthlyPayment } = installmentsOverview(
    [plan('vieja', '2025-01-10T12:00:00', 3, 10_000), plan('nueva', '2026-10-10T12:00:00', 6, 25_000)],
    now
  );
  assert.deepEqual(rows.map((r) => r.installment.id), ['nueva', 'vieja']);
  assert.equal(monthlyPayment, 25_000);
});
