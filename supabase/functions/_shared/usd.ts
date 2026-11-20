const USD_RE = /\bUS(?:D\s?\$?|\s?\$)\s*([0-9](?:[0-9.,]*[0-9])?)/i
const DECIMAL_SEPARATOR_WITH_CENTS_RE = /[.,]([0-9]{1,2})$/
const RATE_TIMEOUT_MS = 5000

export function parseUsdAmount(raw: string | null | undefined): number | null {
  const text = (raw ?? '').replace(/[^0-9.,]/g, '')
  if (!/^[0-9]/.test(text)) return null
  const cents = text.match(DECIMAL_SEPARATOR_WITH_CENTS_RE)
  const whole = (cents ? text.slice(0, cents.index) : text).replace(/[.,]/g, '')
  const amount = Number(`${whole}.${cents?.[1] ?? '0'}`)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

export function formatUsd(amount: number): string {
  return `US$${amount.toFixed(2).replace('.', ',')}`
}

function formatClp(amount: number): string {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function usdIn(text: string): number | null {
  return parseUsdAmount(text.match(USD_RE)?.[1])
}

export function usdToClpInText(text: string, rate: number): { text: string; usd: number | null } {
  const usd = usdIn(text)
  if (usd === null) return { text, usd: null }
  return { text: text.replace(USD_RE, `$${formatClp(Math.round(usd * rate))}`), usd }
}

// deno-lint-ignore no-explicit-any
const RATE_SOURCES_IN_PRIORITY_ORDER: { url: string; read: (body: any) => unknown }[] = [
  { url: 'https://mindicador.cl/api/dolar', read: (body) => body?.serie?.[0]?.valor },
  { url: 'https://open.er-api.com/v6/latest/USD', read: (body) => body?.rates?.CLP },
]

export async function fetchUsdClpRate(): Promise<number> {
  for (const source of RATE_SOURCES_IN_PRIORITY_ORDER) {
    try {
      const res = await fetch(source.url, { signal: AbortSignal.timeout(RATE_TIMEOUT_MS) })
      const rate = res.ok ? Number(source.read(await res.json())) : NaN
      if (Number.isFinite(rate) && rate > 0) return rate
      console.warn('⚠️ Sin valor del dólar en', source.url, res.status)
    } catch (error) {
      console.warn('⚠️ No respondió', source.url, error)
    }
  }
  throw new Error('No se pudo obtener el valor del dólar')
}
