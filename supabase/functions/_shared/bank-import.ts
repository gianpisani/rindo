import { categorizeBatchForUser } from './jev-poc.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { sendBatchNotificationEmail } from './email-notification.ts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Movement {
  date: string
  description: string
  amount: number
  balance: number
  source: string
  card?: string
  installments?: string
  totalAmount?: number
  owner?: string
}

interface Account {
  label?: string
  balance?: number
  movements: Movement[]
}

interface CreditCard {
  label: string
  movements?: Movement[]
}

export interface ScrapeResult {
  success: boolean
  bank: string
  accounts?: Account[]
  creditCards?: CreditCard[]
  error?: string
}

export interface ImportedItem {
  date: string
  description: string
  amount: number
  type: string
}

export interface SkippedItem {
  date: string
  description: string
  amount: number
  type: string
  reason: string
  card?: string
}

export interface ImportResult {
  imported: number
  skipped: number
  importedItems: ImportedItem[]
  skippedItems: SkippedItem[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalizes a bank description for fuzzy comparison.
 * Strips all non-alphanumeric characters and lowercases so that
 * "MERCADOPAGO*SICILY Las Condes CL" matches "Mercadopagosicily las condes cl".
 */
function normalizeBankDescription(desc: string): string {
  return desc.toLowerCase().replace(/[^a-z0-9áéíóúñ]/gi, '').toLowerCase()
}

/**
 * Extracts the counterparty name from a transfer description, stripping
 * known prefixes from both import sources (process-email-v2 y bank-sync),
 * removes accents/case, and returns a token set for order-independent matching.
 * "Transferencia a Sebastian Julian" -> {sebastian, julian}
 * "Traspaso A:Sebastian Julian Perez" -> {sebastian, julian, perez}
 * "Traspaso De:Cecilia Alejandra Ruiz" -> {cecilia, alejandra, ruiz}
 */
function extractNameTokens(desc: string): Set<string> {
  const stripped = desc
    .replace(/^transferencia\s+(a|de)\s*/i, '')
    // "de" además de "a": las transferencias recibidas llegan como "Traspaso De:X".
    // Sin esta variante el nombre quedaba pegado al prefijo ("dececilia") y no
    // cruzaba nunca con el "Transferencia de X" que genera process-email-v2.
    .replace(/^traspaso\s+(a|de):?\s*/i, '')
    // legacy rows que aún tengan "· Banco X" o "(Banco Origen)" al final
    .split('·')[0]
    .replace(/\(.*\)\s*$/, '')

  const normalized = stripped
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes (combining diacritics tras NFD)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')

  return new Set(normalized.split(/\s+/).filter((t) => t.length > 0))
}

const MIN_PREFIX_LENGTH = 4

/** true si el conjunto de tokens más chico está contenido en el más grande */
function nameTokensMatch(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false
  const [small, big] = a.size <= b.size ? [a, b] : [b, a]
  const bigTokens = [...big]
  for (const token of small) {
    if (big.has(token)) continue
    const prefixMatch = bigTokens.some((other) => {
      const [short, long] = token.length <= other.length ? [token, other] : [other, token]
      return short.length >= MIN_PREFIX_LENGTH && long.startsWith(short)
    })
    if (!prefixMatch) return false
  }
  return true
}

function convertDate(dateStr: string, fallbackDate: string): string {
  if (dateStr.toLowerCase() === 'pendiente') return fallbackDate
  const parts = dateStr.split('-')
  if (parts[0].length === 4) return dateStr
  const [dd, mm, yyyy] = parts
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Saca los últimos 4 dígitos de cualquier forma en que el banco identifique
 * la tarjeta: "****1234", "XXXX-XXXX-XXXX-1234", "Visa Signature 1234",
 * "Tarjeta de Crédito ···· 1234". Antes solo se quitaban los asteriscos, así
 * que todo lo que no viniera exactamente como "****1234" no cruzaba contra
 * credit_cards.last_4_digits (que guarda 4 dígitos pelados).
 */
export function extractLastFourDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : null
}

/**
 * Busca la tarjeta activa del usuario por los últimos 4 dígitos.
 * Usa limit(1) en vez de maybeSingle() porque dos tarjetas activas con los
 * mismos 4 dígitos hacían fallar la query y la transacción terminaba sin tarjeta.
 */
export async function resolveCardId(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string,
  rawCard?: string | null,
): Promise<string | null> {
  if (!rawCard) return null
  const lastFour = extractLastFourDigits(rawCard)
  if (!lastFour) return null

  const { data: cards, error } = await supabaseClient
    .from('credit_cards')
    .select('id')
    .eq('user_id', userId)
    .eq('last_4_digits', lastFour)
    .eq('is_active', true)
    .limit(1)

  if (error) {
    console.error('Card match error for', rawCard, error)
    return null
  }
  return cards?.[0]?.id ?? null
}

// ── Main import function ──────────────────────────────────────────────────────

/**
 * Processes a completed ScrapeResult, deduplicates against existing transactions,
 * inserts new ones, auto-categorizes, and optionally sends an email notification.
 *
 * Works with both user-scoped clients (on-demand sync) and service-role clients (cron sync).
 */
export async function importBankMovements(params: {
  supabaseClient: ReturnType<typeof createClient>
  userId: string
  result: ScrapeResult
  trigger: 'manual' | 'cron'
  sendEmail: boolean
}): Promise<ImportResult> {
  const { supabaseClient, userId, result, sendEmail } = params

  let imported = 0
  let skipped = 0
  const toAutoCategorize: { id: string; detail: string }[] = []
  const importedItems: ImportedItem[] = []
  const skippedItems: SkippedItem[] = []

  // Merge all movements and deduplicate in-memory first
  const seenKeys = new Set<string>()
  const allMovements: Movement[] = [
    ...(result.accounts ?? []).flatMap((a) => a.movements),
    // El label de la tarjeta ("Visa ****1234") es la única pista del plástico
    // en varios bancos: los movimientos vienen sin `card` propio. Al aplanar
    // sin heredarlo, todo movimiento de tarjeta de crédito quedaba con
    // card_id null.
    ...(result.creditCards ?? []).flatMap((cc) =>
      (cc.movements ?? []).map((m) => ({ ...m, card: m.card ?? cc.label })),
    ),
  ].filter((m) => {
    const key = `${m.date}|${m.amount}|${m.description}`
    if (seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })

  const syncDate = new Date().toISOString().split('T')[0]

  for (const movement of allMovements) {
    const absAmount = Math.abs(movement.amount)
    const type = movement.amount > 0 ? 'Ingreso' : 'Gasto'

    if (absAmount === 0) {
      skipped++
      skippedItems.push({ date: movement.date, description: movement.description, amount: absAmount, type, reason: 'zero_amount' })
      continue
    }

    const isoDate = convertDate(movement.date, syncDate)
    const now = new Date()
    const insertDate = `${isoDate}T${now.toISOString().slice(11, 19)}`
    const nextDay = new Date(isoDate)
    nextDay.setDate(nextDay.getDate() + 1)
    const nextDayStr = nextDay.toISOString().split('T')[0]

    const description = movement.description

    const cardId = await resolveCardId(supabaseClient, userId, movement.card)

    // Deduplication check — bank-imported rows
    //
    // `isoDate` es la fecha que ya viene liquidada desde el banco, así que se
    // compara directo contra bank_settlement_date cuando la fila existente la
    // tiene (la escribe process-email-v2 para transferencias). Sin esto, una
    // transferencia hecha el sábado quedaba con fecha de sábado por email y de
    // lunes por sync, y la comparación por día calendario no las cruzaba.
    // El fallback por rango de `date` cubre las filas sin fecha de liquidación:
    // las de bank-sync, las de wallet y las anteriores a esa columna.
    const { data: existingBankRows } = await supabaseClient
      .from('transactions')
      .select('id, bank_description, card_id')
      .eq('user_id', userId)
      .eq('amount', absAmount)
      .not('bank_description', 'is', null)
      .or(`bank_settlement_date.eq.${isoDate},and(bank_settlement_date.is.null,date.gte.${isoDate},date.lt.${nextDayStr})`)
      .limit(10)

    const duplicateRow = existingBankRows?.find((row) => {
      if (!row.bank_description) return false
      const a = normalizeBankDescription(description)
      const b = normalizeBankDescription(row.bank_description)
      if (a.includes(b) || b.includes(a)) return true

      // Match específico de transferencias: compara solo el nombre de la
      // contraparte, ya que process-email-v2 ("Transferencia a X") y
      // bank-sync ("Traspaso A:X") usan vocabularios distintos que rompen
      // el match por substring de arriba.
      const isTransferDesc = /^(transferencia|traspaso)/i.test(description) || /^(transferencia|traspaso)/i.test(row.bank_description)
      if (!isTransferDesc) return false
      return nameTokensMatch(extractNameTokens(description), extractNameTokens(row.bank_description))
    })

    const bankDuplicate = !!duplicateRow

    // Deduplication check — manually entered rows
    const { data: existingManualRows } = await supabaseClient
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .gte('date', isoDate)
      .lt('date', nextDayStr)
      .eq('amount', absAmount)
      .is('bank_description', null)
      .limit(1)

    if (bankDuplicate || (existingManualRows && existingManualRows.length > 0)) {
      // La fila ya existe porque llegó antes por email o por wallet, donde el
      // aviso del banco no siempre trae la tarjeta. Si el sync sí la trae, se
      // completa en vez de descartarla con el movimiento duplicado.
      // Solo para duplicados bancarios: ahí el match es por descripción, no
      // solo por fecha y monto como en los manuales.
      if (duplicateRow && cardId && !duplicateRow.card_id) {
        const { error: cardUpdateError } = await supabaseClient
          .from('transactions')
          .update({ card_id: cardId })
          .eq('id', duplicateRow.id)
          .eq('user_id', userId)
        if (cardUpdateError) console.error('Card backfill error:', duplicateRow.id, cardUpdateError)
      }

      skipped++
      skippedItems.push({
        date: movement.date,
        description,
        amount: absAmount,
        type,
        reason: bankDuplicate ? 'bank_duplicate' : 'manual_duplicate',
        card: movement.card,
      })
      continue
    }

    const { data: inserted, error: insertError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: userId,
        date: insertDate,
        import_source: 'bank-sync',
        detail: `🤖 ${description}`,
        bank_description: description,
        type,
        amount: absAmount,
        category_name: 'Sin categoría',
        card_id: cardId,
        installment_id: null,
        reimbursement_for_category: null,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Insert error for movement:', movement.date, movement.description, insertError)
    } else {
      imported++
      importedItems.push({ id: inserted.id, date: movement.date, description, amount: absAmount, type })
      toAutoCategorize.push({ id: inserted.id, detail: description })
    }
  }

  // Auto-categorize via batch call
  if (toAutoCategorize.length > 0) {
    await categorizeBatchForUser(supabaseClient, toAutoCategorize.map(tx => tx.id), userId,
      { apiKey: Deno.env.get('AI_GATEWAY_API_KEY') ?? '' })
      .catch(() => console.error('No se pudo categorizar la importación'))
  }

  // Email notification
  if (sendEmail && imported > 0) {
    try {
      const serviceRoleClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      const { data: userData } = await serviceRoleClient.auth.admin.getUserById(userId)
      const userEmail = userData?.user?.email
      if (userEmail) {
        await sendBatchNotificationEmail({
          to: userEmail,
          bank: result.bank ?? 'Banco',
          transactions: importedItems,
        })
      }
    } catch (emailError) {
      console.error('⚠️ Email notification error:', emailError)
    }
  }

  return { imported, skipped, importedItems, skippedItems }
}
