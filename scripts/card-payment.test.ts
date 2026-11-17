import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CARD_PAYMENT_CATEGORY,
  isCardPaymentCategory,
  isCardPaymentText,
  lastFourIn,
  pickPaymentCard,
} from '../supabase/functions/_shared/card-payment.ts';
import { ingestTransaction } from '../supabase/functions/_shared/ingest-transaction.ts';
import { computeBuckets } from '../src/lib/ledger.ts';
import { summarizeCategoryPeriod } from '../src/lib/category-spending.ts';
import { computeMonthPace } from '../src/lib/month-pace.ts';
import { computeSavingsMonths } from '../src/lib/savings-goal.ts';

// ── Detección al importar ─────────────────────────────────────────────

test('reconoce el cargo del pago de tarjeta en un Gasto, como sea que lo escriba el banco', () => {
  for (const text of [
    '🤖 Pago tarjeta de crédito',
    '🤖 Pago tarjeta de crédito Internacional',
    '🤖 Cargo Por Pago Tc',
    '🤖 Pago Tarjeta De Credito',
    '🤖 Pago Automatico Tarjeta De C',
    '🤖 Cargo por abono/pago de tarj',
    'Cargo por abono/pago de tarjeta de crédito',
    'PAGO AUTOMÁTICO TARJETA DE CRÉDITO',
    'Pago de tarjeta',
    'PAGO PESOS TEF PAGO NORMAL',
  ]) {
    assert.equal(isCardPaymentText('Gasto', text), true, text);
  }
});

test('no confunde compras ni otros cargos con un pago de tarjeta', () => {
  for (const text of [
    '🤖 JUMBO COSTANERA (****1939)',
    'Compra con tarjeta de crédito en LIDER',
    'Pago tarjeta de débito',
    'PAC Enel',
    'Cargo automático',
    'Traspaso A:Sebastian Julian',
    'Pago de cuenta luz',
    'Retiro cajero',
  ]) {
    assert.equal(isCardPaymentText('Gasto', text), false, text);
  }
});

test('un Ingreso solo es pago de tarjeta si es el abono TEF visto desde la tarjeta', () => {
  assert.equal(isCardPaymentText('Ingreso', 'PAGO PESOS TEF PAGO NORMAL'), true);
  assert.equal(isCardPaymentText('Ingreso', 'Pago Pesos TEF'), true);
  // El sueldo real de producción: process-email-v2 le dejó una bank_description genérica.
  assert.equal(isCardPaymentText('Ingreso', '🤖 sueldo + bono', 'Pago tarjeta de crédito'), false);
  assert.equal(isCardPaymentText('Ingreso', 'Cargo Por Pago Tc'), false);
});

test('mira el detalle y la bank_description', () => {
  assert.equal(isCardPaymentText('Gasto', '🤖 Mi tarjeta', 'Cargo Por Pago Tc'), true);
  assert.equal(isCardPaymentText('Gasto', null, undefined), false);
});

test('reconoce la categoría reservada y las que la gente creó a mano', () => {
  assert.equal(CARD_PAYMENT_CATEGORY, 'Pago de tarjeta');
  for (const name of ['Pago de tarjeta', 'Pago Tarjeta', 'pago tarjeta de crédito', 'PAGO DE LA TARJETA', 'Pagos tarjetas']) {
    assert.equal(isCardPaymentCategory(name), true, name);
  }
  for (const name of ['Tarjeta', 'Pago arriendo', 'Pago tarjeta Juan', 'Supermercado', '', null]) {
    assert.equal(isCardPaymentCategory(name), false, String(name));
  }
});

test('saca los últimos 4 dígitos y elige la tarjeta', () => {
  assert.equal(lastFourIn('Pago tarjeta ****1939'), '1939');
  assert.equal(lastFourIn('Pago tarjeta terminada en 4321'), '4321');
  assert.equal(lastFourIn('Pago tarjeta de crédito'), null);
  assert.equal(lastFourIn('Cargo Por Pago Tc 20261115'), null);
  const cards = [{ id: 'a', last_4_digits: '1939' }, { id: 'b', last_4_digits: '4321' }];
  assert.equal(pickPaymentCard(cards, '4321'), 'b');
  assert.equal(pickPaymentCard(cards, null), null, 'con varias tarjetas y sin dígitos, ninguna');
  assert.equal(pickPaymentCard([cards[0]], null), 'a', 'con una sola tarjeta activa, esa');
  assert.equal(pickPaymentCard([cards[0]], '9999'), 'a');
  assert.equal(pickPaymentCard([], null), null);
});

// ── La ingesta compartida (process-email-v2 y la wallet) ──────────────

function fakeClient(cards: { id: string; last_4_digits: string | null }[]) {
  const inserted: Record<string, unknown>[] = [];
  const queried: string[] = [];
  const client = {
    from(table: string) {
      let ilike = false;
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        neq() { return builder; },
        gte() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        ilike() { ilike = true; queried.push('history'); return builder; },
        maybeSingle: async () => ({ data: cards[0] ?? null, error: null }),
        insert(row: Record<string, unknown>) { inserted.push(row); return builder; },
        single: async () => ({ data: { id: 'tx1' }, error: null }),
        then(resolve: (value: unknown) => void) {
          const data = table === 'credit_cards' ? cards
            : ilike ? [{ category_name: 'Deporte' }]
            : [];
          resolve({ data, error: null });
        },
      };
      return builder;
    },
    auth: { admin: { getUserById: async () => ({ data: { user: null } }) } },
  };
  return { client, inserted, queried };
}

const row = (over: Record<string, unknown> = {}) => ({
  user_id: 'u1', date: '2026-11-10T12:00:00Z', type: 'Gasto' as const, amount: 63_312,
  detail: '🤖 Pago tarjeta de crédito', import_source: 'email' as const,
  bank_description: 'Pago tarjeta de crédito', ...over,
});

test('la ingesta asigna "Pago de tarjeta" sin categorizar y vincula la única tarjeta', async () => {
  const db = fakeClient([{ id: 'card1', last_4_digits: '1939' }]);
  const result = await ingestTransaction(db.client as never, row(), { bank: 'Banco de Chile', pushTag: 't' });
  assert.equal(result.category, 'Pago de tarjeta');
  assert.equal(db.inserted[0].category_name, 'Pago de tarjeta');
  assert.equal(db.inserted[0].card_id, 'card1');
  assert.deepEqual(db.queried, [], 'no consulta el historial');
});

test('la ingesta deja sin tarjeta un pago si hay varias y no trae dígitos', async () => {
  const db = fakeClient([{ id: 'a', last_4_digits: '1939' }, { id: 'b', last_4_digits: '4321' }]);
  await ingestTransaction(db.client as never, row(), { bank: 'Banco de Chile', pushTag: 't' });
  assert.equal(db.inserted[0].card_id, null);
});

test('la ingesta no toca el sueldo con bank_description "Pago tarjeta de crédito"', async () => {
  const db = fakeClient([]);
  const result = await ingestTransaction(db.client as never,
    row({ type: 'Ingreso', amount: 3_215_009, detail: '🤖 sueldo + bono' }),
    { bank: 'Banco de Chile', pushTag: 't' });
  assert.notEqual(result.category, 'Pago de tarjeta');
  assert.deepEqual(db.queried, ['history']);
});

// ── Fuera de todos los cálculos ───────────────────────────────────────

const pay = (over: Record<string, unknown> = {}) => ({
  type: 'Gasto', date: '2026-09-10T12:00:00', amount: 500_000, category_name: 'Pago de tarjeta', ...over,
});
const compra = { type: 'Gasto', date: '2026-09-05T12:00:00', amount: 40_000, category_name: 'Comida' };

test('el pago de tarjeta no mueve el líquido en ninguna dirección', () => {
  const entries = [
    { type: 'Ingreso' as const, amount: 1_000_000, category_name: 'Sueldo' },
    { type: 'Gasto' as const, amount: 40_000, category_name: 'Comida' },
    { type: 'Gasto' as const, amount: 40_000, category_name: 'Pago de tarjeta' },
    { type: 'Ingreso' as const, amount: 40_000, category_name: 'Pago de tarjeta' },
    { type: 'Gasto' as const, amount: 10_000, category_name: 'Pago Tarjeta' },
  ];
  assert.equal(computeBuckets(entries).liquido, 960_000);
});

test('el pago de tarjeta no entra a "Por categoría" ni a los límites', () => {
  const rows = summarizeCategoryPeriod([compra, pay(), pay({ type: 'Ingreso' }), pay({ category_name: 'Pago Tarjeta' })],
    new Date('2026-09-01T00:00:00'), new Date('2026-09-30T23:59:59'));
  assert.deepEqual([...rows.keys()], ['Comida']);
});

test('el pago de tarjeta no entra al ritmo del mes', () => {
  const today = new Date(2026, 8, 15, 12);
  const pace = computeMonthPace([compra, pay()], today, { today });
  assert.equal(pace.spentSoFar, 40_000);
});

test('el pago de tarjeta nunca es "el golpe" del mes', () => {
  const [month] = computeSavingsMonths([compra, pay()], 100_000, new Date(2026, 8, 1), 1);
  assert.equal(month.biggestHit?.amount, 40_000);
});
