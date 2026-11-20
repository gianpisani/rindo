// Compras en dólares. Rindo guarda todo en pesos, así que un monto en US$ se
// convierte al dólar observado del día y el original queda a la vista en el
// detalle ("Zwift, Inc. · US$23,79"). Es una estimación: el banco cobra al tipo
// de cambio del día en que se paga la tarjeta.
//
// La parte pura no tiene imports a propósito: la usan Deno y node --test.

const USD_RE = /\bUS(?:D\s?\$?|\s?\$)\s*([0-9](?:[0-9.,]*[0-9])?)/i

/** "23,79", "23.79", "1.234,56" o "1,234.56" → número. Null si no es un monto. */
export function parseUsdAmount(raw: string | null | undefined): number | null {
  const text = (raw ?? '').replace(/[^0-9.,]/g, '')
  if (!/^[0-9]/.test(text)) return null
  // El último separador es decimal solo si lo siguen 1 o 2 dígitos; si no, es de miles.
  const decimals = text.match(/[.,]([0-9]{1,2})$/)
  const whole = (decimals ? text.slice(0, decimals.index) : text).replace(/[.,]/g, '')
  const amount = Number(`${whole}.${decimals?.[1] ?? '0'}`)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

/** 23.79 → "US$23,79" */
export function formatUsd(amount: number): string {
  return `US$${amount.toFixed(2).replace('.', ',')}`
}

/** Pesos con separador de miles: 23711 → "23.711". */
function formatClp(amount: number): string {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** El primer monto en dólares del texto ("US$23,79", "USD 23.79"), o null. */
export function usdIn(text: string): number | null {
  return parseUsdAmount(text.match(USD_RE)?.[1])
}

/**
 * Reescribe el monto en dólares del texto como pesos ("US$23,79" → "$23.711")
 * para que los parsers de siempre lo lean sin saber de monedas.
 */
export function usdToClpInText(text: string, rate: number): { text: string; usd: number | null } {
  const usd = usdIn(text)
  if (usd === null) return { text, usd: null }
  return { text: text.replace(USD_RE, `$${formatClp(Math.round(usd * rate))}`), usd }
}

/** Dónde preguntar el dólar, en orden. La segunda cubre las caídas de la primera. */
// deno-lint-ignore no-explicit-any
const RATE_SOURCES: { url: string; read: (body: any) => unknown }[] = [
  // Dólar observado del Banco Central.
  { url: 'https://mindicador.cl/api/dolar', read: (body) => body?.serie?.[0]?.valor },
  // Tipo de cambio de mercado, actualizado una vez al día.
  { url: 'https://open.er-api.com/v6/latest/USD', read: (body) => body?.rates?.CLP },
]

/**
 * Pesos por dólar hoy. Lanza si ninguna fuente responde: es preferible
 * reintentar a guardar un monto inventado.
 */
export async function fetchUsdClpRate(): Promise<number> {
  for (const source of RATE_SOURCES) {
    try {
      const res = await fetch(source.url, { signal: AbortSignal.timeout(5000) })
      const rate = res.ok ? Number(source.read(await res.json())) : NaN
      if (Number.isFinite(rate) && rate > 0) return rate
      console.warn('⚠️ Sin valor del dólar en', source.url, res.status)
    } catch (e) {
      console.warn('⚠️ No respondió', source.url, e)
    }
  }
  throw new Error('No se pudo obtener el valor del dólar')
}
