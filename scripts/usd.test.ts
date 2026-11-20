import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatUsd, parseUsdAmount, usdIn, usdToClpInText } from '../supabase/functions/_shared/usd.ts';

test('lee montos en dólares con coma o punto decimal', () => {
  assert.equal(parseUsdAmount('23,79'), 23.79);
  assert.equal(parseUsdAmount('23.79'), 23.79);
  assert.equal(parseUsdAmount('1.234,56'), 1234.56);
  assert.equal(parseUsdAmount('1,234.56'), 1234.56);
  assert.equal(parseUsdAmount('US$ 9,5'), 9.5);
  assert.equal(parseUsdAmount('120'), 120);
  assert.equal(parseUsdAmount('1.200'), 1200);
  assert.equal(parseUsdAmount(''), null);
  assert.equal(parseUsdAmount('0'), null);
});

test('encuentra dólares solo cuando el texto lo dice', () => {
  assert.equal(usdIn('una compra por US$23,79 con Tarjeta de Crédito ****0000 en ZWIFT, INC. el 18/11/2026 23:30.'), 23.79);
  assert.equal(usdIn('compra por USD 10.00 en TIENDA'), 10);
  assert.equal(usdIn('compra por $5.000 con Tarjeta de Crédito ****0000 en TIENDA'), null);
  assert.equal(usdIn('BUS $5.000 PLUS 300'), null);
});

test('reescribe la compra en dólares como pesos y deja el resto intacto', () => {
  const email = 'se ha realizado una compra por US$23,79 con Tarjeta de Crédito ****0000 en ZWIFT, INC. el 18/11/2026 23:30.';
  const { text, usd } = usdToClpInText(email, 996.68);
  assert.equal(usd, 23.79);
  assert.equal(text, 'se ha realizado una compra por $23.711 con Tarjeta de Crédito ****0000 en ZWIFT, INC. el 18/11/2026 23:30.');
  // El parser de compras de process-email-v2 tiene que calzar con el texto reescrito.
  assert.match(text, /compra por \$\s*([0-9]{1,3}(?:[.,][0-9]{3})*)\s+con\s+Tarjeta/);
  assert.equal(formatUsd(usd), 'US$23,79');

  const pesos = 'compra por $5.000 con Tarjeta de Débito ****0000 en TIENDA';
  assert.deepEqual(usdToClpInText(pesos, 996.68), { text: pesos, usd: null });
});
