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
 */
function extractNameTokens(desc: string): Set<string> {
  const stripped = desc
    .replace(/^transferencia\s+(a|de)\s*/i, '')
    .replace(/^traspaso\s+a:?\s*/i, '')
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

/** true si el conjunto de tokens más chico está contenido en el más grande */
function nameTokensMatch(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false
  const [small, big] = a.size <= b.size ? [a, b] : [b, a]
  for (const token of small) {
    if (!big.has(token)) return false
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
    ...(result.creditCards ?? []).flatMap((cc) => cc.movements ?? []),
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
      .select('id, bank_description')
      .eq('user_id', userId)
      .eq('amount', absAmount)
      .not('bank_description', 'is', null)
      .or(`bank_settlement_date.eq.${isoDate},and(bank_settlement_date.is.null,date.gte.${isoDate},date.lt.${nextDayStr})`)
      .limit(10)

    const bankDuplicate = existingBankRows?.some((row) => {
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

    // Match credit card by last 4 digits
    let cardId: string | null = null
    if (movement.card) {
      const lastFour = movement.card.replace(/\*/g, '')
      const { data: card } = await supabaseClient
        .from('credit_cards')
        .select('id')
        .eq('user_id', userId)
        .eq('last_4_digits', lastFour)
        .eq('is_active', true)
        .maybeSingle()
      if (card) cardId = card.id
    }

    const { data: inserted, error: insertError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: userId,
        date: insertDate,
        import_source: 'bank-sync',
        detail: description,
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!

    const { data: userCategories } = await supabaseClient
      .from('categories')
      .select('name')
      .eq('user_id', userId)
    const existingCategories = (userCategories ?? []).map((c: { name: string }) => c.name)

    await fetch(`${supabaseUrl}/functions/v1/auto-categorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
      body: JSON.stringify({
        transactions: toAutoCategorize.map(({ id, detail }) => ({ id, detail })),
        userId,
        existingCategories,
      }),
    }).catch((e) => console.error('Batch auto-categorize error:', e))
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
