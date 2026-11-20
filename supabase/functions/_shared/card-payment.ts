import { stripAccents } from './text.ts'

export const CARD_PAYMENT_CATEGORY = 'Pago de tarjeta'
export const CARD_PAYMENT_ICON = '💳'

const CARD_PAYMENT_CATEGORY_RE = /^pagos? (?:de )?(?:la )?tarjetas?(?: de credito)?$/
const CARD_PAYMENT_CHARGE_RE =
  /\b(?:cargo por (?:abono ?\/ ?)?pago|pago(?: automatico)?) (?:de )?(?:la )?(?:tarjeta|tarj|tc)\b(?! (?:de )?debito)/
const CARD_PAYMENT_CREDIT_SIDE_TEF_RE = /\bpago (?:pesos|dolares|usd) tef\b/
const LAST_FOUR_RE = /(?:\*{2,}|x{3,}|•{2,}|terminada en |n[°º] ?|nro\.? ?)(\d{4})\b/

function normalizeText(text: string | null | undefined): string {
  return stripAccents(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function isCardPaymentCategory(name: string | null | undefined): boolean {
  return CARD_PAYMENT_CATEGORY_RE.test(normalizeText(name))
}

export function isCardPaymentText(type: string, ...texts: (string | null | undefined)[]): boolean {
  return texts.some((raw) => {
    const text = normalizeText(raw)
    if (!text) return false
    if (CARD_PAYMENT_CREDIT_SIDE_TEF_RE.test(text)) return type === 'Gasto' || type === 'Ingreso'
    return type === 'Gasto' && CARD_PAYMENT_CHARGE_RE.test(text)
  })
}

export function lastFourIn(...texts: (string | null | undefined)[]): string | null {
  for (const raw of texts) {
    const match = normalizeText(raw).match(LAST_FOUR_RE)
    if (match) return match[1]
  }
  return null
}

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

// deno-lint-ignore no-explicit-any
type AnyClient = any

async function paymentCardFor(client: AnyClient, userId: string, lastFour: string | null): Promise<string | null> {
  const { data, error } = await client
    .from('credit_cards')
    .select('id, last_4_digits')
    .eq('user_id', userId)
    .eq('is_active', true)
  if (error) {
    console.error('⚠️ No se pudieron leer las tarjetas para el pago:', error)
    return null
  }
  return pickPaymentCard(data ?? [], lastFour)
}

async function activeCardWithLastFour(client: AnyClient, userId: string, lastFour: string): Promise<string | null> {
  const { data, error } = await client
    .from('credit_cards')
    .select('id')
    .eq('user_id', userId)
    .eq('last_4_digits', lastFour)
    .eq('is_active', true)
    .maybeSingle()
  if (error) {
    console.error('⚠️ No se pudo buscar la tarjeta por sus últimos 4 dígitos:', error)
    return null
  }
  return data?.id ?? null
}

export function cardForMovement(
  client: AnyClient,
  userId: string,
  movement: { isCardPayment: boolean; lastFour: string | null; texts: (string | null | undefined)[] },
): Promise<string | null> {
  if (movement.isCardPayment) return paymentCardFor(client, userId, movement.lastFour || lastFourIn(...movement.texts))
  if (movement.lastFour) return activeCardWithLastFour(client, userId, movement.lastFour)
  return Promise.resolve(null)
}
