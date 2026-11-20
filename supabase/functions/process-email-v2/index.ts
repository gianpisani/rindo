import { bankSettlementDate } from '../_shared/business-day.ts'
import { json, preflight } from '../_shared/http.ts'
import { ingestTransaction } from '../_shared/ingest-transaction.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { BANK_IMPORT_MARK } from '../_shared/text.ts'
import { fetchUsdClpRate, formatUsd, usdIn, usdToClpInText } from '../_shared/usd.ts'

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
  isTransfer?: boolean
}

const DEFAULT_BANK = 'Banco de Chile'
const UNKNOWN_BANK = 'Banco'
const FALLBACK_DETAIL_SUBJECT_CHARS = 50

const HTML_ENTITIES: Record<string, string> = {
  aacute: '\u00E1', eacute: '\u00E9', iacute: '\u00ED', oacute: '\u00F3', uacute: '\u00FA', uuml: '\u00FC',
  ntilde: '\u00F1', Aacute: '\u00C1', Eacute: '\u00C9', Iacute: '\u00CD', Oacute: '\u00D3', Uacute: '\u00DA',
  Ntilde: '\u00D1', amp: '&', nbsp: ' ', quot: '"', apos: "'", bull: '\u00B7', deg: '\u00B0',
  ordm: '\u00BA', lt: '<', gt: '>',
}

function normalizeEmailText(text: string): string {
  return text
    .replace(/[\u200B-\u200F\u2028\u2029\uFEFF\u00AD\u034F\u061C\u180E]/g, '')
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

  name = name
    .replace(/\s+(?:SANTIAGO|LAS CONDES|PROVIDENCIA|VITACURA|LO BARNECHEA|[ÑN]U[ÑN]OA|MACUL|LA FLORIDA|MAIPU|MAIP[UÚ]|RECOLETA|SAN MIGUEL|PE[ÑN]ALOL[EÉ]N|LA REINA|HUECHURABA|QUILICURA|CONCHAL[IÍ]|PUENTE ALTO|SAN BERNARDO|RENCA|CERRILLOS|TEMUCO|VALPARAISO|VI[ÑN]A DEL MAR|CONCEPCION|ANTOFAGASTA|TALCA|CHILLAN|OSORNO|VALDIVIA|PUERTO MONTT|IQUIQUE|ARICA|RANCAGUA|COQUIMBO|LA SERENA)\s+CL$/i, '')
    .replace(/\s+CL$/i, '')

  name = name.replace(/^MERCADOPAGO\*\s*/i, '')
  name = name.replace(/^SQ\s*\*\s*/i, '')
  name = name.replace(/^PAY\s*\*\s*/i, '')

  name = name.replace(/\s+/g, ' ').trim()

  name = name.split(' ').map(w =>
    w.length <= 2 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ')

  return name || raw.trim()
}

const PERSON_NAME_CHARS = "A-ZÁÉÍÓÚÜÑa-záéíóúüñ.,'*_\\-\\s"

const EMAIL_WORDS_NOT_A_NAME = /^(?:fondos|cliente|clientes|dinero|transferencia|cuenta|nuestro|nuestra)$/i

function personNameOrNullIfEmailWording(raw: string | undefined): string | null {
  if (!raw) return null
  const name = raw
    .replace(/[*_]/g, '')
    .replace(/^[\s.,;:]+|[\s.,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (name.length < 2) return null
  if (name.split(' ').every((w) => EMAIL_WORDS_NOT_A_NAME.test(w))) return null
  return name
}

function parseCompraTarjeta(text: string): ParsedTransaction | null {
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
      bank: DEFAULT_BANK,
      cardLastFour: tarjeta,
      bankDescription: match[3].trim(),
    }
  }

  return null
}

function parseTransferenciaTerceros(text: string): ParsedTransaction | null {
  const isIncoming = /(?:a|hacia)\s+tu\s+cuenta|has\s+recibido\s+una\s+transferencia|te\s+han\s+transferido|abono\s+por\s+transferencia/i.test(text)
  if (isIncoming) return null

  const isOutgoing = /transferencia a terceros|ha\s+efectuado\s+una\s+transferencia\s+de\s+fondos|transferencias?\s+de\s+fondos\s+a\s+(?!tu\s+cuenta)/i.test(text)
    || /comprobante\s+(?:electr[oó]nico\s+)?de\s+transferencia\s+de\s+fondos\s+realizada/i.test(text)
  if (!isOutgoing) return null

  const amount = extractAmount(text)
  if (!amount) return null

  const destinatario =
    personNameOrNullIfEmailWording(text.match(new RegExp(`Nombre(?:\\s+y\\s+Apellido)?\\s+([${PERSON_NAME_CHARS}]+?)(?:\\s+Rut|\\s+Tipo|\\s+N[º°]|\\s+Banco|\\s+E-?mail|$)`, 'i'))?.[1])
    || personNameOrNullIfEmailWording(text.match(new RegExp(`transferencia\\s+de\\s+fondos\\s+a\\s+(?!tu\\b)([${PERSON_NAME_CHARS}]+?)(?:,|\\s+el\\s+d[ií]a|\\s+desde)`, 'i'))?.[1])

  const detail = destinatario
    ? `Transferencia a ${destinatario}`
    : 'Transferencia a terceros'

  const bank = detectBank('', text)

  return { amount, type: 'Gasto', detail, bank: bank !== UNKNOWN_BANK ? bank : DEFAULT_BANK, isTransfer: true }
}

function parseTransferenciaRecibida(text: string): ParsedTransaction | null {
  const isIncoming =
    /has\s+recibido\s+una\s+transferencia|transferencia\s+(?:de\s+fondos\s+)?a\s+tu\s+cuenta|transferencia\s+electr[oó]nica|abono\s+por\s+transferencia|te\s+han\s+transferido/i.test(text)
  if (!isIncoming) return null

  const amount = extractAmount(text)
  if (!amount) return null

  const senderPatternsMostSpecificFirst = [
    new RegExp(`nuestr[oa]\\s*\\(?\\s*a?\\s*\\)?\\s+client[ea]\\s*\\(?\\s*a?\\s*\\)?\\s+([${PERSON_NAME_CHARS}]+?)\\s*(?:\\([^)]{0,40}\\))?\\s+(?:ha\\s+(?:efectuado|realizado)|te\\s+ha|Datos)`, 'i'),
    new RegExp(`Datos\\s+de(?:l)?\\s+(?:remitente|origen|ordenante)\\b.{0,80}?Nombre(?:\\s+y\\s+Apellido)?\\s+([${PERSON_NAME_CHARS}]+?)\\s+(?:Rut|R\\.?U\\.?T|Banco|Cuenta|Monto|Email|E-?mail)`, 'i'),
    new RegExp(`transferencia\\s+(?:electr[oó]nica\\s+)?(?:de\\s+fondos\\s+)?de\\s+(?!fondos\\b)([${PERSON_NAME_CHARS}]+?)\\s+(?:hacia|a)\\s+tu\\s+cuenta`, 'i'),
    new RegExp(`(?:te\\s+han\\s+transferido|abono\\s+por\\s+transferencia)\\b.{0,40}?\\bde\\s+(?!fondos\\b)([${PERSON_NAME_CHARS}]+?)\\s+(?:por|el|Rut|Monto|$)`, 'i'),
  ]

  let remitente: string | null = null
  for (const pattern of senderPatternsMostSpecificFirst) {
    remitente = personNameOrNullIfEmailWording(text.match(pattern)?.[1])
    if (remitente) break
  }

  const detail = remitente ? `Transferencia de ${remitente}` : 'Transferencia recibida'

  const bank = detectBank('', text)

  return { amount, type: 'Ingreso', detail, bank: bank !== UNKNOWN_BANK ? bank : DEFAULT_BANK, isTransfer: true }
}

function parsePagoTarjeta(text: string): ParsedTransaction | null {
  if (!/pago de tarjeta|pago tarjeta de cr[eé]dito/i.test(text)) return null

  const amount = extractAmount(text)
  if (!amount) return null

  return { amount, type: 'Gasto', detail: 'Pago tarjeta de crédito', bank: DEFAULT_BANK }
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
    bank: DEFAULT_BANK,
  }
}

function parseGiroRetiro(text: string): ParsedTransaction | null {
  if (!/retiro.*cajero|giro.*cajero/i.test(text)) return null

  const amount = extractAmount(text)
  if (!amount) return null

  return { amount, type: 'Gasto', detail: 'Retiro cajero', bank: DEFAULT_BANK }
}

function extractAmount(text: string): number | null {
  const match = text.match(/\$\s*([0-9]{1,3}(?:\.[0-9]{3})*)/)
  if (match) {
    const amount = parseInt(match[1].replace(/\./g, ''), 10)
    if (amount > 0) return amount
  }

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
  return UNKNOWN_BANK
}

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

const parsersMostSpecificFirst = [
  parseCompraTarjeta,
  parseTransferenciaTerceros,
  parseTransferenciaRecibida,
  parsePagoTarjeta,
  parseCargoAutomatico,
  parseGiroRetiro,
]

function transactionDate(timestamp?: string, date?: string): string {
  return new Date(timestamp || date || Date.now()).toISOString()
}

function parseEmail(text: string): ParsedTransaction | null {
  for (const parser of parsersMostSpecificFirst) {
    const parsed = parser(text)
    if (parsed) return parsed
  }
  return null
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse

  try {
    const { subject, content, from, date, timestamp, user_id } = await req.json() as EmailPayload
    if (!user_id) return json({ success: false, error: 'user_id es requerido' }, 400)

    console.log('📧 Email recibido para', user_id)

    let text = stripBankFooter(normalizeEmailText(`${subject || ''} ${content || ''}`))

    if (isPromotionalEmail(subject || '', text)) {
      console.log('🚫 Email promocional, ignorando')
      return json({ success: false, skipped: true, reason: 'Email promocional, no es una transacción' })
    }

    const occurredAt = transactionDate(timestamp, date)

    let usd: number | null = null
    if (usdIn(text) !== null) {
      ({ text, usd } = usdToClpInText(text, await fetchUsdClpRate()))
    }

    const bank = detectBank(from || '', text)
    let parsed = parseEmail(text)

    if (!parsed) {
      const amount = extractAmount(text)
      if (!amount) {
        console.log('⚠️ No se pudo parsear el email, ignorando')
        return json({ success: false, error: 'No se pudo extraer información del email' }, 400)
      }

      const looksTransactional = /comprobante|has realizado|se ha realizado|ha efectuado|exitosa|cargo|abono/i.test(text)
      if (!looksTransactional) {
        console.log('🚫 Email no parece transaccional, ignorando')
        return json({ success: false, skipped: true, reason: 'No parece un email transaccional' })
      }

      const isIngreso = /recibida|abono|depósito|deposito|ingreso/i.test(text)
      parsed = {
        amount,
        type: isIngreso ? 'Ingreso' : 'Gasto',
        detail: `${bank} - ${subject?.substring(0, FALLBACK_DETAIL_SUBJECT_CHARS) || 'Transacción bancaria'}`,
        bank,
      }
    }

    if (parsed.bank === DEFAULT_BANK && bank !== UNKNOWN_BANK) parsed.bank = bank
    if (usd !== null) parsed.detail += ` · ${formatUsd(usd)}`

    const bankDescription = parsed.bankDescription ?? parsed.detail
    parsed.detail = `${BANK_IMPORT_MARK} ${parsed.detail}`

    console.log('💰 Parseado:', { type: parsed.type, bank: parsed.bank, isTransfer: Boolean(parsed.isTransfer) })

    const supabase = serviceClient()
    const settlementDate = parsed.isTransfer
      ? await bankSettlementDate(supabase, new Date(occurredAt), { bank: parsed.bank })
      : null

    const { id, category, weeklyStats } = await ingestTransaction(supabase, {
      user_id,
      date: occurredAt,
      bank_settlement_date: settlementDate,
      import_source: 'email',
      detail: parsed.detail,
      bank_description: bankDescription,
      type: parsed.type,
      amount: parsed.amount,
    }, { bank: parsed.bank, pushTag: 'email-transaction', cardLastFour: parsed.cardLastFour })

    return json({
      success: true,
      transaction_id: id,
      parsed: {
        amount: parsed.amount,
        type: parsed.type,
        bank: parsed.bank,
        detail: parsed.detail,
        category,
        weeklyStats,
      },
    })
  } catch (error) {
    console.error('❌ Error procesando el email:', error)
    return json({ success: false, error: 'No se pudo procesar el email' }, 500)
  }
})
