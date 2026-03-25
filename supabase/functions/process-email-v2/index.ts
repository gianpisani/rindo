import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

interface EmailPayload {
  subject: string
  content: string
  from: string
  date?: string
  timestamp?: string
  user_id: string
}

interface ParsedTransaction {
  amount: number
  type: 'Gasto' | 'Ingreso'
  detail: string
  bank: string
  cardLastFour?: string
}

// ── Text normalization ──────────────────────────────────────────────
// Gmail's getPlainBody() wraps lines and injects invisible chars.
// Normalize to a single continuous line so regexes work reliably.

function normalizeEmailText(text: string): string {
  return text
    .replace(/[\u200B-\u200F\u2028\u2029\uFEFF\u00AD\u034F\u061C\u180E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripBankFooter(text: string): string {
  const markers = [
    'revisa saldos y movimientos',
    'sigue estos consejos para evitar fraudes',
    'nunca te llamaremos solicitando',
    'realiza todo de forma',
    'este e-mail fue generado automaticamente',
    'importante: este e-mail fue generado',
    'mi banco mi pass',
  ]

  const lower = text.toLowerCase()
  let cutIndex = text.length

  for (const marker of markers) {
    const idx = lower.indexOf(marker)
    if (idx > 0 && idx < cutIndex) {
      cutIndex = idx
    }
  }

  return text.substring(0, cutIndex).trim()
}

function cleanMerchantName(raw: string): string {
  let name = raw.trim()

  // Remove trailing "Ciudad CL" patterns
  name = name
    .replace(/\s+(?:SANTIAGO|LAS CONDES|PROVIDENCIA|VITACURA|LO BARNECHEA|[ÑN]U[ÑN]OA|MACUL|LA FLORIDA|MAIPU|MAIP[UÚ]|RECOLETA|SAN MIGUEL|PE[ÑN]ALOL[EÉ]N|LA REINA|HUECHURABA|QUILICURA|CONCHAL[IÍ]|PUENTE ALTO|SAN BERNARDO|RENCA|CERRILLOS|TEMUCO|VALPARAISO|VI[ÑN]A DEL MAR|CONCEPCION|ANTOFAGASTA|TALCA|CHILLAN|OSORNO|VALDIVIA|PUERTO MONTT|IQUIQUE|ARICA|RANCAGUA|COQUIMBO|LA SERENA)\s+CL$/i, '')
    .replace(/\s+CL$/i, '')

  // Common payment platform prefixes
  name = name.replace(/^MERCADOPAGO\*\s*/i, '')
  name = name.replace(/^SQ\s*\*\s*/i, '')
  name = name.replace(/^PAY\s*\*\s*/i, '')

  name = name.replace(/\s+/g, ' ').trim()

  // Title case
  name = name.split(' ').map(w =>
    w.length <= 2 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ')

  return name || raw.trim()
}

// ── Parsers por tipo de email ──────────────────────────────────────

function parseCompraTarjeta(text: string): ParsedTransaction | null {
  // "compra por $5.000 con Tarjeta de Crédito ****1939 en MERCADOPAGO*KRISPYKREME Las Condes CL el 22/02/2026 12:30"
  const match = text.match(
    /compra por \$\s*([0-9]{1,3}(?:[.,][0-9]{3})*)\s+con\s+Tarjeta de (?:Cr[eé]dito|D[eé]bito)\s+\*{2,4}(\d+)\s+en\s+(.+?)\s+el\s+\d{1,2}\/\d{2}\/\d{4}/i
  )

  if (match) {
    const amount = parseInt(match[1].replace(/[.,]/g, ''), 10)
    const tarjeta = match[2]
    const comercio = cleanMerchantName(match[3])

    return {
      amount,
      type: 'Gasto',
      detail: `${comercio} (****${tarjeta})`,
      bank: 'Banco de Chile',
      cardLastFour: tarjeta,
    }
  }

  return null
}

function parseTransferenciaTerceros(text: string): ParsedTransaction | null {
  // Banco de Chile: "Transferencia a terceros"
  // Itaú/otros: "comprobante electronico de transferencia de fondos realizada"
  const isOutgoing = /transferencia a terceros|comprobante\s+(?:electr[oó]nico\s+)?de\s+transferencia\s+de\s+fondos\s+realizada/i.test(text)
  if (!isOutgoing) return null

  const amount = extractAmount(text)
  if (!amount) return null

  // Recipient name: "Nombre y Apellido  X" or "Nombre  X"
  const destinatario =
    text.match(/Nombre(?:\s+y\s+Apellido)?\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?:\s+Rut|\s+Tipo|\s+N[º°]|\s+Banco|\s+E-?mail|$)/i)?.[1]?.trim()

  // Destination bank: "Banco  Banco BCI/MACHBANK" or "Banco  Scotiabank Sud Americano"
  const bancoDestino =
    text.match(/Banco\s+(.+?)(?:\s+Email|\s+Monto|\s+Mensaje|\s+Cuenta\s+de\s+destino|\s+Tipo\s+de\s+Cuenta|\s+Comentario)/i)?.[1]?.trim()

  const parts = [destinatario, bancoDestino].filter(Boolean)
  const detail = parts.length > 0
    ? `Transferencia a ${parts.join(' · ')}`
    : 'Transferencia a terceros'

  const bank = detectBank('', text)

  return { amount, type: 'Gasto', detail, bank: bank !== 'Banco' ? bank : 'Banco de Chile' }
}

function parseTransferenciaRecibida(text: string): ParsedTransaction | null {
  // Banco de Chile:  "nuestro(a) cliente X ha efectuado una transferencia de fondos a tu cuenta"
  // BCI/Mach:        "Has recibido una transferencia de fondos de X hacia tu cuenta"
  // BancoEstado:     "Has recibido una Transferencia Electrónica de nuestro(a) cliente X"
  const isIncoming =
    /has\s+recibido\s+una\s+transferencia|transferencia\s+(?:de\s+fondos\s+)?a\s+tu\s+cuenta|transferencia\s+electr[oó]nica|abono\s+por\s+transferencia|te\s+han\s+transferido/i.test(text)
  if (!isIncoming) return null

  const amount = extractAmount(text)
  if (!amount) return null

  let remitente: string | null = null

  // "nuestro(a) cliente NOMBRE ha efectuado" (Banco de Chile, BancoEstado)
  if (!remitente) {
    const m = text.match(/nuestr[oa]\(?a?\)?\s+cliente\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)\s+(?:ha\s+efectuado|Datos)/i)
    if (m) remitente = m[1].trim()
  }

  // "transferencia de fondos de NOMBRE hacia tu cuenta" (BCI/Mach)
  if (!remitente) {
    const m = text.match(/transferencia\s+(?:de\s+fondos\s+)?de\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)\s+(?:hacia|a)\s+tu\s+cuenta/i)
    if (m) remitente = m[1].trim()
  }

  // Source bank: "Banco de origen  Banco Bci / Mach"
  const bancoOrigen =
    text.match(/Banco\s+de\s+origen\s+(.+?)(?:\s+Fecha|\s+Mensaje|\s+N[úu]mero|\s+Monto)/i)?.[1]?.trim()

  let detail = 'Transferencia recibida'
  if (remitente) {
    detail = `Transferencia de ${remitente}`
    if (bancoOrigen) detail += ` (${bancoOrigen})`
  }

  const bank = detectBank('', text)

  return { amount, type: 'Ingreso', detail, bank: bank !== 'Banco' ? bank : 'Banco de Chile' }
}

function parsePagoTarjeta(text: string): ParsedTransaction | null {
  if (!/pago de tarjeta|pago tarjeta de cr[eé]dito/i.test(text)) return null

  const amount = extractAmount(text)
  if (!amount) return null

  return { amount, type: 'Gasto', detail: 'Pago tarjeta de crédito', bank: 'Banco de Chile' }
}

function parseCargoAutomatico(text: string): ParsedTransaction | null {
  if (!/cargo autom[aá]tico|pago autom[aá]tico|pac\b/i.test(text)) return null

  const amount = extractAmount(text)
  if (!amount) return null

  const empresa = text.match(/(?:empresa|comercio|en)\s*[:\s]+([^\n\r]+)/i)?.[1]?.trim()

  return {
    amount,
    type: 'Gasto',
    detail: empresa ? `PAC ${empresa}` : 'Cargo automático',
    bank: 'Banco de Chile',
  }
}

function parseGiroRetiro(text: string): ParsedTransaction | null {
  if (!/retiro.*cajero|giro.*cajero/i.test(text)) return null

  const amount = extractAmount(text)
  if (!amount) return null

  return { amount, type: 'Gasto', detail: 'Retiro cajero', bank: 'Banco de Chile' }
}

// ── Helpers ────────────────────────────────────────────────────────

function extractAmount(text: string): number | null {
  // Match "$200.000" or "$3.600" or "$15.000.000"
  const match = text.match(/\$\s*([0-9]{1,3}(?:\.[0-9]{3})*)/);
  if (match) {
    const amount = parseInt(match[1].replace(/\./g, ''), 10)
    if (amount > 0) return amount
  }

  // Fallback: "Monto $200000" or "Monto: 200000"
  const fallback = text.match(/monto[:\s]*\$?\s*([0-9]+)/i)
  if (fallback) {
    const amount = parseInt(fallback[1], 10)
    if (amount > 0) return amount
  }

  return null
}

function detectBank(from: string, text: string): string {
  const combined = `${from} ${text}`.toLowerCase()
  if (combined.includes('bancochile') || combined.includes('banco de chile') || combined.includes('banco chile')) return 'Banco de Chile'
  if (combined.includes('bci') || combined.includes('mach')) return 'BCI'
  if (combined.includes('santander')) return 'Santander'
  if (combined.includes('bancoestado') || combined.includes('banco estado')) return 'BancoEstado'
  if (combined.includes('itau') || combined.includes('itaú')) return 'Itaú'
  if (combined.includes('scotiabank')) return 'Scotiabank'
  if (combined.includes('falabella')) return 'Banco Falabella'
  if (combined.includes('security')) return 'Banco Security'
  if (combined.includes('bice')) return 'BICE'
  return 'Banco'
}

// ── Spam / promo filter ────────────────────────────────────────────

function isPromotionalEmail(subject: string, text: string): boolean {
  const promoPatterns = [
    /descuento|dto\.|promoción|promocion|oferta|beneficio/i,
    /vacaciones|viaja|código\s+\w+|cupón|cupon/i,
    /sorteo|concurso|gana\s+un|participa/i,
    /newsletter|suscripción|suscripcion|novedades/i,
    /invitación|invitacion|webinar|evento/i,
    /seguro\s+(?:gratis|desde)|contrata/i,
    /puntos\s+(?:extra|doble|triple)/i,
    /cashback|devolvemos|reembolso/i,
    /nuevo\s+(?:producto|servicio|beneficio)/i,
    /activa\s+tu|enrola|descarga\s+la\s+app/i,
  ]

  const transactionalPatterns = [
    /comprobante|transferencia\s+(?:a|recibida|exitosa)/i,
    /compra\s+(?:por|con\s+tarjeta)|cargo\s+(?:en|por)/i,
    /pago\s+(?:de\s+tarjeta|exitoso|realizado)/i,
    /retiro\s+(?:en\s+)?cajero|giro\s+(?:en\s+)?cajero|abono\s+por/i,
    /has\s+realizado|se\s+ha\s+realizado/i,
    /has\s+recibido\s+una\s+transferencia/i,
    /transferencia\s+electr[oó]nica/i,
  ]

  for (const pattern of transactionalPatterns) {
    if (pattern.test(subject) || pattern.test(text)) return false
  }

  for (const pattern of promoPatterns) {
    if (pattern.test(subject) || pattern.test(text)) return true
  }

  return false
}

// ── Main ───────────────────────────────────────────────────────────

const parsers = [
  parseCompraTarjeta,
  parseTransferenciaTerceros,
  parseTransferenciaRecibida,
  parsePagoTarjeta,
  parseCargoAutomatico,
  parseGiroRetiro,
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { subject, content, from, date, timestamp, user_id } = await req.json() as EmailPayload

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id es requerido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('📧 Email recibido:', { subject, from, date, timestamp, user_id })

    // Normalize: collapse whitespace, strip invisible chars, remove footer
    const rawText = `${subject || ''} ${content || ''}`
    const text = stripBankFooter(normalizeEmailText(rawText))

    if (isPromotionalEmail(subject || '', text)) {
      console.log('🚫 Email promocional, ignorando:', subject)
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: 'Email promocional, no es una transacción' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Use exact timestamp from email, fallback to date, fallback to now
    let transactionDate: string
    if (timestamp) {
      transactionDate = new Date(timestamp).toISOString()
    } else if (date) {
      transactionDate = new Date(date).toISOString()
    } else {
      transactionDate = new Date().toISOString()
    }

    const bank = detectBank(from || '', text)

    // Try each parser until one matches
    let parsed: ParsedTransaction | null = null
    for (const parser of parsers) {
      parsed = parser(text)
      if (parsed) break
    }

    if (!parsed) {
      const amount = extractAmount(text)
      if (!amount) {
        console.log('⚠️ No se pudo parsear el email, ignorando')
        return new Response(
          JSON.stringify({ success: false, error: 'No se pudo extraer información del email' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const looksTransactional = /comprobante|has realizado|se ha realizado|exitosa|cargo|abono/i.test(text)
      if (!looksTransactional) {
        console.log('🚫 Email no parece transaccional, ignorando:', subject)
        return new Response(
          JSON.stringify({ success: false, skipped: true, reason: 'No parece un email transaccional' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      const isIngreso = /recibida|abono|depósito|deposito|ingreso/i.test(text)
      parsed = {
        amount,
        type: isIngreso ? 'Ingreso' : 'Gasto',
        detail: `${bank} - ${subject?.substring(0, 50) || 'Transacción bancaria'}`,
        bank,
      }
    }

    if (parsed.bank === 'Banco de Chile' && bank !== 'Banco') {
      parsed.bank = bank
    }

    parsed.detail = `🤖 ${parsed.detail}`

    console.log('💰 Parseado:', parsed)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Auto-categorize: check user's history for similar details
    let categoryName = 'Sin categoría'
    try {
      // Use first meaningful word (skip the 🤖 prefix)
      const searchDetail = parsed.detail.replace(/^🤖\s*/, '')
      const searchTerm = searchDetail.split(/[\s(]/)[0]

      if (searchTerm && searchTerm.length > 2 && !/^transferencia$/i.test(searchTerm)) {
        const { data: similar } = await supabase
          .from('transactions')
          .select('category_name')
          .eq('user_id', user_id)
          .neq('category_name', 'Sin categoría')
          .neq('category_name', '⚡ Analizando...')
          .ilike('detail', `%${searchTerm}%`)
          .limit(5)

        if (similar && similar.length > 0) {
          const counts: Record<string, number> = {}
          for (const tx of similar) {
            counts[tx.category_name] = (counts[tx.category_name] || 0) + 1
          }
          const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
          if (best) categoryName = best[0]
        }
      }
    } catch (e) {
      console.error('⚠️ Auto-categorize error:', e)
    }

    // Match credit card by last 4 digits
    let cardId: string | null = null
    if (parsed.cardLastFour) {
      try {
        const { data: card } = await supabase
          .from('credit_cards')
          .select('id')
          .eq('user_id', user_id)
          .eq('last_4_digits', parsed.cardLastFour)
          .eq('is_active', true)
          .maybeSingle()

        if (card) {
          cardId = card.id
          console.log(`💳 Tarjeta matched: ****${parsed.cardLastFour} → ${card.id}`)
        }
      } catch (e) {
        console.error('⚠️ Card match error:', e)
      }
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user_id,
        date: transactionDate,
        detail: parsed.detail,
        category_name: categoryName,
        type: parsed.type,
        amount: parsed.amount,
        card_id: cardId,
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error al crear transacción:', error)
      throw error
    }

    console.log('✅ Transacción creada:', data.id, parsed.detail, parsed.amount)

    // Push notification
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      const emoji = parsed.type === 'Ingreso' ? '💰' : '💳'
      const formatted = new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
      }).format(parsed.amount)

      await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          userId: user_id,
          notification: {
            title: `${emoji} ${parsed.type}: ${formatted}`,
            body: parsed.detail,
            tag: 'email-transaction',
            requireInteraction: true,
          },
        }),
      })
    } catch (pushError) {
      console.error('⚠️ Push notification error:', pushError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: data.id,
        parsed: {
          amount: parsed.amount,
          type: parsed.type,
          bank: parsed.bank,
          detail: parsed.detail,
          category: categoryName,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
