import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

const USER_ID = "42f87eb6-3bb8-4a8d-83b0-8dc8f2680879"

interface EmailPayload {
  subject: string
  content: string
  from: string
  date?: string
  // Timestamp exacto del email (ISO string o epoch ms)
  timestamp?: string
}

interface ParsedTransaction {
  amount: number
  type: 'Gasto' | 'Ingreso'
  detail: string
  bank: string
}

// ── Parsers por tipo de email ──────────────────────────────────────

function parseTransferenciaTerceros(text: string): ParsedTransaction | null {
  // "Transferencia a terceros" → Gasto
  if (!/transferencia a terceros/i.test(text)) return null

  const amount = extractAmount(text)
  if (!amount) return null

  // Extraer destinatario: "Nombre y Apellido  Gianfranco Carniglia"
  const destinatario = text.match(/Nombre y Apellido\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?:\s+Rut|\s+Tipo|\s+Nº|\s+Banco|$)/i)?.[1]?.trim()
    ?? text.match(/Destinatario[:\s]+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?:\s+Rut|\s+Tipo|$)/i)?.[1]?.trim()

  // Extraer banco destino: "Banco Banco Santander" → "Banco Santander"
  const bancoDestinoMatch = text.match(/Banco\s+(Banco\s+\w+|\w+)\s+(?:Email|Monto|Mensaje)/i)
  const bancoDestino = bancoDestinoMatch?.[1]?.trim()

  const parts = [destinatario, bancoDestino].filter(Boolean)
  const detail = parts.length > 0
    ? `Transferencia a ${parts.join(' · ')}`
    : 'Transferencia a terceros'

  return { amount, type: 'Gasto', detail, bank: 'Banco de Chile' }
}

function parseTransferenciaRecibida(text: string): ParsedTransaction | null {
  if (!/transferencia recibida|te han transferido|abono por transferencia/i.test(text)) return null

  const amount = extractAmount(text)
  if (!amount) return null

  const remitente = text.match(/(?:Remitente|Nombre)[:\s]+([^\n\r]+)/i)?.[1]?.trim()

  const detail = remitente
    ? `Transferencia de ${remitente}`
    : 'Transferencia recibida'

  return { amount, type: 'Ingreso', detail, bank: 'Banco de Chile' }
}

function parseCompraTarjeta(text: string): ParsedTransaction | null {
  // "compra por $3.600 con Tarjeta de Crédito ****1939 en THINK COFFEE BAR"
  const compraMatch = text.match(
    /compra por \$\s*([0-9]{1,3}(?:[.,][0-9]{3})*)\s+con\s+Tarjeta de (?:Crédito|Débito)\s+\*{2,4}(\d+)\s+en\s+([^\n\r]+?)(?:\s+el\s+|\s*$)/i
  )

  if (compraMatch) {
    const amount = parseInt(compraMatch[1].replace(/[.,]/g, ''), 10)
    const tarjeta = compraMatch[2]
    let comercio = compraMatch[3].trim()
      .replace(/\s+SANTIAGO\s+CL$/i, '')
      .replace(/\s+CL$/i, '')
      .replace(/\s+/g, ' ')
      .trim()

    // Title case para el comercio
    comercio = comercio.split(' ').map(w =>
      w.length <= 2 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(' ')

    return {
      amount,
      type: 'Gasto',
      detail: `${comercio} (TC ****${tarjeta})`,
      bank: 'Banco de Chile',
    }
  }

  // Fallback genérico para compras con tarjeta
  if (!/compra.*tarjeta/i.test(text)) return null

  const amount = extractAmount(text)
  if (!amount) return null

  const comercioMatch = text.match(/en\s+([A-Z][A-Z\s]+?)(?:\s+el\s|\s+SANTIAGO|\s+CL|\n)/i)
  const comercio = comercioMatch?.[1]?.trim() ?? 'Compra con tarjeta'

  return { amount, type: 'Gasto', detail: comercio, bank: 'Banco de Chile' }
}

function parsePagoTarjeta(text: string): ParsedTransaction | null {
  if (!/pago de tarjeta|pago tarjeta de crédito/i.test(text)) return null

  const amount = extractAmount(text)
  if (!amount) return null

  return { amount, type: 'Gasto', detail: 'Pago tarjeta de crédito', bank: 'Banco de Chile' }
}

function parseCargoAutomatico(text: string): ParsedTransaction | null {
  if (!/cargo automático|pago automático|pac\b/i.test(text)) return null

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
  if (!/giro|retiro.*cajero/i.test(text)) return null

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
  if (combined.includes('bancochile') || combined.includes('banco de chile')) return 'Banco de Chile'
  if (combined.includes('bci')) return 'BCI'
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
    /retiro|giro|abono\s+por/i,
    /has\s+realizado|se\s+ha\s+realizado/i,
  ]

  // If it matches a transactional pattern, it's NOT promo
  for (const pattern of transactionalPatterns) {
    if (pattern.test(subject) || pattern.test(text)) return false
  }

  // If it matches promo patterns, skip it
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
    const { subject, content, from, date, timestamp } = await req.json() as EmailPayload

    console.log('📧 Email recibido:', { subject, from, date, timestamp })

    const text = `${subject || ''} ${content || ''}`

    // Filter out promotional emails
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
      // No parser matched — only create transaction if we can extract a real amount
      // from a clearly transactional context
      const amount = extractAmount(text)
      if (!amount) {
        console.log('⚠️ No se pudo parsear el email, ignorando')
        return new Response(
          JSON.stringify({ success: false, error: 'No se pudo extraer información del email' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Double-check: does this look like a real transaction email?
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

    // Override bank if parser didn't detect it
    if (parsed.bank === 'Banco de Chile' && bank !== 'Banco') {
      parsed.bank = bank
    }

    // Prefix with 🤖
    parsed.detail = `🤖 ${parsed.detail}`

    console.log('💰 Parseado:', parsed)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Auto-categorize: check user's history for similar details
    let categoryName = 'Sin categoría'
    try {
      const { data: similar } = await supabase
        .from('transactions')
        .select('category_name')
        .eq('user_id', USER_ID)
        .neq('category_name', 'Sin categoría')
        .neq('category_name', '⚡ Analizando...')
        .ilike('detail', `%${parsed.detail.split(' ')[0]}%`)
        .limit(5)

      if (similar && similar.length > 0) {
        // Use the most common category
        const counts: Record<string, number> = {}
        for (const tx of similar) {
          counts[tx.category_name] = (counts[tx.category_name] || 0) + 1
        }
        const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
        if (best) categoryName = best[0]
      }
    } catch (e) {
      console.error('⚠️ Auto-categorize error:', e)
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: USER_ID,
        date: transactionDate,
        detail: parsed.detail,
        category_name: categoryName,
        type: parsed.type,
        amount: parsed.amount,
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
          userId: USER_ID,
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
