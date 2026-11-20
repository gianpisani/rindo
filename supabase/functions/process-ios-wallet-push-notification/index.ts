import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { ingestTransaction } from '../_shared/ingest-transaction.ts'
import { fetchUsdClpRate, formatUsd, parseUsdAmount } from '../_shared/usd.ts'

const walletCorsHeaders = {
  ...corsHeaders,
  'Access-Control-Allow-Headers':
    corsHeaders['Access-Control-Allow-Headers'] +
    ', comercio, cantidad, divisa, tarjeta, banco, digitos, usuario',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: walletCorsHeaders })
  }

  try {
    let comercio: string | null = null
    let cantidad: string | null = null
    let divisa: string | null = null
    let tarjeta: string | null = null
    let banco: string | null = null
    let digitos: string | null = null
    let usuario: string | null = null

    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') || ''
      if (contentType.includes('application/x-www-form-urlencoded')) {
        // Form data — used by iOS Shortcuts "Get Contents of URL" with Form body
        const formData = await req.formData()
        const f = (name: string) => formData.get(name)?.toString() || null
        comercio = f('comercio')
        cantidad = f('cantidad')
        divisa = f('divisa')
        tarjeta = f('tarjeta')
        banco = f('banco')
        digitos = f('digitos')
        usuario = f('usuario')
      } else {
        // JSON body
        const body = await req.json()
        comercio = body.comercio ?? null
        cantidad = body.cantidad != null ? String(body.cantidad) : null
        divisa = body.divisa ?? null
        tarjeta = body.tarjeta ?? null
        banco = body.banco ?? null
        digitos = body.digitos != null ? String(body.digitos) : null
        usuario = body.usuario ?? null
      }
    } else {
      // GET — read from query params first, headers as fallback
      const url = new URL(req.url)
      const q = (name: string) => url.searchParams.get(name)
      const h = (name: string) => {
        const val = req.headers.get(name)
        return val ? decodeURIComponent(val) : null
      }
      comercio = q('comercio') || h('comercio')
      cantidad = q('cantidad') || h('cantidad')
      divisa = q('divisa') || h('divisa')
      tarjeta = q('tarjeta') || h('tarjeta')
      banco = q('banco') || h('banco')
      digitos = q('digitos') || h('digitos')
      usuario = q('usuario') || h('usuario')
    }

    if (!comercio || !cantidad || !usuario) {
      return new Response(
        JSON.stringify({ success: false, error: 'comercio, cantidad y usuario son requeridos' }),
        { headers: { ...walletCorsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const divisaUpper = divisa ? divisa.toUpperCase() : 'CLP'

    // Parse amount — handle CLP format: "5.500" or "$5,500" or "5500".
    // En dólares el monto trae decimales ("23,79") y se pasa a pesos al dólar del día.
    const usd = divisaUpper === 'USD' ? parseUsdAmount(cantidad) : null
    const rawAmount = cantidad.replace(/[$\s]/g, '').replace(/\./g, '').replace(/,/g, '')
    const parsedAmount = usd !== null
      ? Math.round(usd * await fetchUsdClpRate())
      : parseInt(rawAmount, 10)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: `Monto inválido: "${cantidad}"` }),
        { headers: { ...walletCorsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Build detail: "📱 Starbucks", "📱 Starbucks · US$23,79" or "📱 Starbucks (EUR)"
    const divisaSuffix = usd !== null
      ? ` · ${formatUsd(usd)}`
      : divisaUpper !== 'CLP' ? ` (${divisaUpper})` : ''
    const detail = `📱 ${comercio}${divisaSuffix}`

    const bankName = banco || 'Banco'
    const transactionDate = new Date().toISOString()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { id, category, weeklyStats } = await ingestTransaction(supabase, {
      user_id: usuario,
      date: transactionDate,
      import_source: 'wallet',
      detail,
      bank_description: `${comercio}${divisaSuffix}`,
      type: 'Gasto',
      amount: parsedAmount,
    }, { bank: bankName, pushTag: 'wallet-transaction', cardLastFour: digitos })

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: id,
        parsed: {
          amount: parsedAmount,
          type: 'Gasto',
          bank: bankName,
          detail,
          category,
          weeklyStats,
        },
      }),
      { headers: { ...walletCorsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error:', error)
    let msg: string
    try {
      msg = JSON.stringify(error)
    } catch {
      msg = error instanceof Error ? error.message : String(error)
    }
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...walletCorsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
