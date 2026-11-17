// El pago de la tarjeta de crédito NO es un gasto: cada compra ya se registró
// como Gasto el día en que se hizo. Pagar la tarjeta solo mueve plata de la
// cuenta a la deuda. Este módulo es la fuente única de esa regla, para la
// importación (edge functions) y para la app (src/lib/ledger.ts lo re-exporta).
//
// Sin imports a propósito: lo usan Deno, Vite y node --test.

/** La categoría reservada. No entra a gastos, ingresos, límites, ritmo ni líquido. */
export const CARD_PAYMENT_CATEGORY = 'Pago de tarjeta'
export const CARD_PAYMENT_ICON = '💳'

/** Minúsculas, sin acentos y con un espacio entre palabras. */
export function normalizeText(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Una categoría que significa "pago de tarjeta", se llame como se llame:
 * "Pago de tarjeta" (la reservada), "Pago Tarjeta" o "Pago tarjeta de crédito"
 * (las que algunos usuarios crearon a mano antes de que existiera).
 */
const CARD_PAYMENT_CATEGORY_RE = /^pagos? (?:de )?(?:la )?tarjetas?(?: de credito)?$/

export function isCardPaymentCategory(name: string | null | undefined): boolean {
  return CARD_PAYMENT_CATEGORY_RE.test(normalizeText(name))
}

/**
 * El cargo en la cuenta corriente: "Pago tarjeta de crédito (Internacional)",
 * "Pago Automatico Tarjeta De C", "Cargo Por Pago Tc", "Cargo por abono/pago de
 * tarj". Un "pago tarjeta de débito" es otra cosa y no calza.
 */
export const CARD_PAYMENT_EXPENSE_RE =
  /\b(?:cargo por (?:abono ?\/ ?)?pago|pago(?: automatico)?) (?:de )?(?:la )?(?:tarjeta|tarj|tc)\b(?! (?:de )?debito)/

/**
 * El abono visto desde la cuenta de la tarjeta (bank-sync): "PAGO PESOS TEF
 * PAGO NORMAL". Es la única señal válida para un Ingreso: process-email-v2 usa
 * "Pago tarjeta de crédito" como descripción genérica y hay sueldos con ella.
 */
export const CARD_PAYMENT_TEF_RE = /\bpago (?:pesos|dolares|usd) tef\b/

/** ¿Este movimiento importado es el pago de una tarjeta? */
export function isCardPaymentText(type: string, ...texts: (string | null | undefined)[]): boolean {
  return texts.some((raw) => {
    const text = normalizeText(raw)
    if (!text) return false
    if (CARD_PAYMENT_TEF_RE.test(text)) return type === 'Gasto' || type === 'Ingreso'
    return type === 'Gasto' && CARD_PAYMENT_EXPENSE_RE.test(text)
  })
}

/** Los últimos 4 dígitos que traiga el texto ("****1939", "terminada en 1939", "N° 1939", "Nro 1939"). */
export function lastFourIn(...texts: (string | null | undefined)[]): string | null {
  for (const raw of texts) {
    const match = normalizeText(raw).match(/(?:\*{2,}|x{3,}|•{2,}|terminada en |n[°º] ?|nro\.? ?)(\d{4})\b/)
    if (match) return match[1]
  }
  return null
}

/**
 * A qué tarjeta va el pago: la de los 4 dígitos, si el texto (o el banco) los
 * trae; si no, la única tarjeta activa del usuario; si tiene varias, ninguna.
 */
export function pickPaymentCard(
  cards: { id: string; last_4_digits: string | null }[],
  lastFour: string | null,
): string | null {
  if (lastFour) {
    const match = cards.find((card) => card.last_4_digits === lastFour)
    if (match) return match.id
  }
  return cards.length === 1 ? cards[0].id : null
}

/** Busca las tarjetas activas del usuario y elige con `pickPaymentCard`. Nunca lanza. */
// deno-lint-ignore no-explicit-any
export async function paymentCardFor(client: any, userId: string, lastFour: string | null): Promise<string | null> {
  try {
    const { data } = await client
      .from('credit_cards')
      .select('id, last_4_digits')
      .eq('user_id', userId)
      .eq('is_active', true)
    return pickPaymentCard(data ?? [], lastFour)
  } catch (e) {
    console.error('⚠️ Card payment match error:', e)
    return null
  }
}
