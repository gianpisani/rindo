import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { sendNotificationEmail } from '../_shared/email-notification.ts'
import { bankSettlementDate } from '../_shared/business-day.ts'

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
  bankDescription?: string
  /** Las transferencias las liquida el banco en día hábil; ver bank_settlement_date. */
  isTransfer?: boolean
}

// ── Text normalization ──────────────────────────────────────────────
// Gmail's getPlainBody() wraps lines and injects invisible chars.
// Normalize to a single continuous line so regexes work reliably.

const HTML_ENTITIES: Record<string, string> = {
  aacute: '\u00E1', eacute: '\u00E9', iacute: '\u00ED', oacute: '\u00F3', uacute: '\u00FA', uuml: '\u00FC',
  ntilde: '\u00F1', Aacute: '\u00C1', Eacute: '\u00C9', Iacute: '\u00CD', Oacute: '\u00D3', Uacute: '\u00DA',
  Ntilde: '\u00D1', amp: '&', nbsp: ' ', quot: '"', apos: "'", bull: '\u00B7', deg: '\u00B0',
  ordm: '\u00BA', lt: '<', gt: '>',
}

function normalizeEmailText(text: string): string {
  return text
    .replace(/[\u200B-\u200F\u2028\u2029\uFEFF\u00AD\u034F\u061C\u180E]/g, '')
    // Los correos del banco son HTML y marcan la contraparte con <b>. Seg\u00FAn c\u00F3mo
    // se convierta el cuerpo a texto, ese \u00E9nfasis puede sobrevivir como tag o
    // como asteriscos pegados al nombre, y ah\u00ED rompe la extracci\u00F3n: los patrones
    // buscan el nombre entre "cliente" y "ha efectuado", as\u00ED que cualquier
    // car\u00E1cter de markup en medio hace que no calcen.
    .replace(/<[^>\n]{1,200}>/g, ' ')
    .replace(/&([a-zA-Z]{2,8});/g, (full, name) => HTML_ENTITIES[name] ?? full)
    .replace(/&#(\d{1,5});/g, (_, code) => String.fromCharCode(Number(code)))
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

// Los patrones ubican el nombre de la contraparte por lo que lo rodea, así que
// la clase de caracteres tiene que aceptar todo lo que puede venir dentro: las
// iniciales abreviadas ("Juan P."), los apellidos con guion o apóstrofe, y el
// énfasis que algunos conversores de HTML a texto dejan como asteriscos
// alrededor del nombre. `cleanPersonName` saca esos asteriscos después.
const NAME_CHARS = "A-ZÁÉÍÓÚÜÑa-záéíóúüñ.,'*_\\-\\s"

/** Palabras del texto del email que nunca son un nombre de persona. */
const NOT_A_NAME = /^(?:fondos|cliente|clientes|dinero|transferencia|cuenta|nuestro|nuestra)$/i

/**
 * Limpia un nombre capturado y descarta los falsos positivos: si la captura
 * quedó en una palabra del propio texto del email (típicamente "fondos"), es
 * preferible no tener nombre a guardar uno inventado, porque bank-sync
 * deduplica comparando justamente estos nombres.
 */
function cleanPersonName(raw: string | undefined): string | null {
  if (!raw) return null
  const name = raw
    .replace(/[*_]/g, '')
    .replace(/^[\s.,;:]+|[\s.,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (name.length < 2) return null
  if (name.split(' ').every((w) => NOT_A_NAME.test(w))) return null
  return name
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
      bankDescription: match[3].trim(),
    }
  }

  return null
}

function parseTransferenciaTerceros(text: string): ParsedTransaction | null {
  // Banco de Chile format 1: "Transferencia a terceros"
  // Banco de Chile format 2: "ha efectuado una transferencia de fondos a [Nombre]"
  // Itaú/otros: "comprobante electronico de transferencia de fondos realizada"
  // Descartar primero las entrantes. El email de transferencia recibida de Banco
  // de Chile ("nuestro(a) cliente X ha efectuado una transferencia de fondos a tu
  // cuenta") calza con la segunda alternativa de isOutgoing, así que sin este
  // guard se registraba como Gasto y tomaba el nombre del titular de destino
  // —o sea, el propio usuario— como si fuera el destinatario.
  const isIncoming = /(?:a|hacia)\s+tu\s+cuenta|has\s+recibido\s+una\s+transferencia|te\s+han\s+transferido|abono\s+por\s+transferencia/i.test(text)
  if (isIncoming) return null

  const isOutgoing = /transferencia a terceros|ha\s+efectuado\s+una\s+transferencia\s+de\s+fondos|transferencias?\s+de\s+fondos\s+a\s+(?!tu\s+cuenta)/i.test(text)
    || /comprobante\s+(?:electr[oó]nico\s+)?de\s+transferencia\s+de\s+fondos\s+realizada/i.test(text)
  if (!isOutgoing) return null

  const amount = extractAmount(text)
  if (!amount) return null

  // Recipient name: "Nombre y Apellido  X" or "Nombre  X"
  // Format 2: "transferencia de fondos a [Nombre],"
  const destinatario =
    cleanPersonName(text.match(new RegExp(`Nombre(?:\\s+y\\s+Apellido)?\\s+([${NAME_CHARS}]+?)(?:\\s+Rut|\\s+Tipo|\\s+N[º°]|\\s+Banco|\\s+E-?mail|$)`, 'i'))?.[1])
    || cleanPersonName(text.match(new RegExp(`transferencia\\s+de\\s+fondos\\s+a\\s+(?!tu\\b)([${NAME_CHARS}]+?)(?:,|\\s+el\\s+d[ií]a|\\s+desde)`, 'i'))?.[1])

  const detail = destinatario
    ? `Transferencia a ${destinatario}`
    : 'Transferencia a terceros'

  const bank = detectBank('', text)

  return { amount, type: 'Gasto', detail, bank: bank !== 'Banco' ? bank : 'Banco de Chile', isTransfer: true }
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

  // El orden importa: la primera alternativa que calce gana. Las que apuntan a
  // una sección explícita del email van antes que las que leen la frase suelta.
  const remitentePatterns = [
    // "nuestro(a) cliente NOMBRE ha efectuado" (Banco de Chile, BancoEstado)
    // El "(a)" viene a veces pegado y a veces separado ("nuestro (a) cliente"), y
    // el nombre puede traer el RUT entre paréntesis antes del verbo.
    new RegExp(`nuestr[oa]\\s*\\(?\\s*a?\\s*\\)?\\s+client[ea]\\s*\\(?\\s*a?\\s*\\)?\\s+([${NAME_CHARS}]+?)\\s*(?:\\([^)]{0,40}\\))?\\s+(?:ha\\s+(?:efectuado|realizado)|te\\s+ha|Datos)`, 'i'),
    // "Datos del remitente / Nombre y Apellido NOMBRE". Se acota a la sección de
    // origen a propósito: el email de Banco de Chile también trae un bloque
    // "Datos de destinatario" con el nombre del propio usuario, y tomarlo de ahí
    // dejaba la transferencia a nombre de quien la recibe.
    new RegExp(`Datos\\s+de(?:l)?\\s+(?:remitente|origen|ordenante)\\b.{0,80}?Nombre(?:\\s+y\\s+Apellido)?\\s+([${NAME_CHARS}]+?)\\s+(?:Rut|R\\.?U\\.?T|Banco|Cuenta|Monto|Email|E-?mail)`, 'i'),
    // "transferencia de fondos de NOMBRE hacia tu cuenta" (BCI/Mach). El
    // lookahead evita que "una transferencia de fondos a tu cuenta" —el texto de
    // Banco de Chile— capture la palabra "fondos" como si fuera el remitente.
    new RegExp(`transferencia\\s+(?:electr[oó]nica\\s+)?(?:de\\s+fondos\\s+)?de\\s+(?!fondos\\b)([${NAME_CHARS}]+?)\\s+(?:hacia|a)\\s+tu\\s+cuenta`, 'i'),
    // "te han transferido $X de NOMBRE" / "abono por transferencia de NOMBRE"
    new RegExp(`(?:te\\s+han\\s+transferido|abono\\s+por\\s+transferencia)\\b.{0,40}?\\bde\\s+(?!fondos\\b)([${NAME_CHARS}]+?)\\s+(?:por|el|Rut|Monto|$)`, 'i'),
  ]

  let remitente: string | null = null
  for (const pattern of remitentePatterns) {
    remitente = cleanPersonName(text.match(pattern)?.[1])
    if (remitente) break
  }

  const detail = remitente ? `Transferencia de ${remitente}` : 'Transferencia recibida'

  const bank = detectBank('', text)

  return { amount, type: 'Ingreso', detail, bank: bank !== 'Banco' ? bank : 'Banco de Chile', isTransfer: true }
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
    /comprobante|transferencias?\s+(?:a|de\s+fondos|recibida|exitosa)/i,
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

      const looksTransactional = /comprobante|has realizado|se ha realizado|ha efectuado|exitosa|cargo|abono/i.test(text)
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

    const bankDescription = parsed.bankDescription ?? parsed.detail

    console.log('💰 Parseado:', parsed)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // El banco liquida las transferencias en día hábil: una hecha el sábado la
    // reporta con fecha del lunes. Guardamos esa fecha aparte para que bank-sync
    // reconozca el movimiento como duplicado, sin perder la fecha real en `date`.
    const settlementDate = parsed.isTransfer
      ? await bankSettlementDate(supabase, new Date(transactionDate), { bank: parsed.bank })
      : null

    // Auto-categorize: check user's history for similar details
    let categoryName = 'Sin categoría'
    try {
      // Use first meaningful word
      const searchTerm = parsed.detail.split(/[\s(]/)[0]

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
        bank_settlement_date: settlementDate,
        import_source: 'email',
        detail: parsed.detail,
        bank_description: bankDescription,
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

    // Weekly category stats for email notification
    let weeklyStats = null
    try {
      const now = new Date(transactionDate)
      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 6)
      const weekAgoStr = weekAgo.toISOString().split('T')[0]

      const { data: weekTxns } = await supabase
        .from('transactions')
        .select('date, amount, detail')
        .eq('user_id', user_id)
        .eq('category_name', categoryName)
        .eq('type', parsed.type)
        .gte('date', weekAgoStr)
        .order('amount', { ascending: false })

      if (weekTxns && weekTxns.length > 0) {
        const dailyTotals: { date: string; day: string; total: number }[] = []
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now)
          d.setDate(d.getDate() - i)
          const dateStr = d.toISOString().split('T')[0]
          const dayTotal = weekTxns
            .filter(t => t.date.startsWith(dateStr))
            .reduce((sum, t) => sum + t.amount, 0)
          dailyTotals.push({
            date: dateStr,
            day: dayNames[d.getDay()],
            total: dayTotal,
          })
        }

        const top3 = weekTxns.slice(0, 3).map(t => ({
          detail: t.detail.replace(/^[🤖📱]\s*/u, ''),
          amount: t.amount,
        }))

        const weekTotal = weekTxns.reduce((sum, t) => sum + t.amount, 0)
        weeklyStats = { dailyTotals, top3, weekTotal, count: weekTxns.length }
      }
    } catch (e) {
      console.error('⚠️ Weekly stats error:', e)
    }

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

    // Email notification via Resend
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(user_id)
      const userEmail = userData?.user?.email
      if (userEmail) {
        await sendNotificationEmail({
          to: userEmail,
          amount: parsed.amount,
          detail: parsed.detail,
          category: categoryName,
          bank: parsed.bank,
          type: parsed.type,
          weeklyStats,
        })
      } else {
        console.warn('⚠️ No email found for user', user_id)
      }
    } catch (emailError) {
      console.error('⚠️ Email notification error:', emailError)
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
          weeklyStats,
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
