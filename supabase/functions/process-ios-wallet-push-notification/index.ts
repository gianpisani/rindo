import { corsHeaders, json, preflight } from '../_shared/http.ts'
import { ingestTransaction } from '../_shared/ingest-transaction.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { WALLET_MARK } from '../_shared/text.ts'
import { fetchUsdClpRate, formatUsd, parseUsdAmount } from '../_shared/usd.ts'

const WALLET_FIELDS = ['comercio', 'cantidad', 'divisa', 'tarjeta', 'banco', 'digitos', 'usuario'] as const
type WalletField = typeof WALLET_FIELDS[number]
type WalletInput = Record<WalletField, string | null>

const walletCorsHeaders = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': `${corsHeaders['Access-Control-Allow-Headers']}, ${WALLET_FIELDS.join(', ')}`,
}

function fieldsFrom(read: (field: WalletField) => string | null): WalletInput {
  return Object.fromEntries(WALLET_FIELDS.map((field) => [field, read(field)])) as WalletInput
}

async function walletInput(req: Request): Promise<WalletInput> {
  if (req.method !== 'POST') {
    const url = new URL(req.url)
    const header = (name: string) => {
      const value = req.headers.get(name)
      return value ? decodeURIComponent(value) : null
    }
    return fieldsFrom((field) => url.searchParams.get(field) || header(field))
  }

  if ((req.headers.get('content-type') || '').includes('application/x-www-form-urlencoded')) {
    const formData = await req.formData()
    return fieldsFrom((field) => formData.get(field)?.toString() || null)
  }

  const body = await req.json()
  return fieldsFrom((field) => body[field] != null ? String(body[field]) : null)
}

function clpAmount(cantidad: string): number {
  return parseInt(cantidad.replace(/[$\s]/g, '').replace(/\./g, '').replace(/,/g, ''), 10)
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req, walletCorsHeaders)
  if (preflightResponse) return preflightResponse

  try {
    const { comercio, cantidad, divisa, banco, digitos, usuario } = await walletInput(req)
    if (!comercio || !cantidad || !usuario) {
      return json({ success: false, error: 'comercio, cantidad y usuario son requeridos' }, 400, walletCorsHeaders)
    }

    const currency = divisa ? divisa.toUpperCase() : 'CLP'
    const usd = currency === 'USD' ? parseUsdAmount(cantidad) : null
    const amount = usd !== null ? Math.round(usd * await fetchUsdClpRate()) : clpAmount(cantidad)
    if (isNaN(amount) || amount <= 0) {
      return json({ success: false, error: `Monto inválido: "${cantidad}"` }, 400, walletCorsHeaders)
    }

    const currencySuffix = usd !== null
      ? ` · ${formatUsd(usd)}`
      : currency !== 'CLP' ? ` (${currency})` : ''
    const detail = `${WALLET_MARK} ${comercio}${currencySuffix}`
    const bank = banco || 'Banco'

    const { id, category, weeklyStats } = await ingestTransaction(serviceClient(), {
      user_id: usuario,
      date: new Date().toISOString(),
      import_source: 'wallet',
      detail,
      bank_description: `${comercio}${currencySuffix}`,
      type: 'Gasto',
      amount,
    }, { bank, pushTag: 'wallet-transaction', cardLastFour: digitos })

    return json({
      success: true,
      transaction_id: id,
      parsed: { amount, type: 'Gasto', bank, detail, category, weeklyStats },
    }, 200, walletCorsHeaders)
  } catch (error) {
    console.error('❌ Error en la wallet:', error)
    return json({ success: false, error: 'No se pudo registrar el movimiento' }, 500, walletCorsHeaders)
  }
})
