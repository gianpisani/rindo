import { categorizeBankImport, type BankCategorizeItem } from './bank-categorize.ts'
import { CARD_PAYMENT_CATEGORY, cardForMovement, isCardPaymentText } from './card-payment.ts'
import { UNCATEGORIZED } from './category-rules.ts'
import { sendBatchNotificationEmail, userEmail } from './email-notification.ts'
import { serviceClient, type Client } from './supabase.ts'
import { BANK_IMPORT_MARK, stripAccents } from './text.ts'

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
  id?: string
  date: string
  description: string
  amount: number
  type: string
}

interface SkippedItem {
  date: string
  description: string
  amount: number
  type: string
  reason: string
  card?: string
}

interface ImportResult {
  imported: number
  skipped: number
  importedItems: ImportedItem[]
  skippedItems: SkippedItem[]
}

type DuplicateReason = 'bank_duplicate' | 'manual_duplicate'

const MIN_NAME_PREFIX_LENGTH = 4
const BANK_ROWS_TO_COMPARE = 10
const TRANSFER_RE = /^(transferencia|traspaso)/i

function compactDescription(desc: string): string {
  return desc.toLowerCase().replace(/[^a-z0-9áéíóúñ]/gi, '')
}

function sameCompactDescription(a: string, b: string): boolean {
  const left = compactDescription(a)
  const right = compactDescription(b)
  return left.includes(right) || right.includes(left)
}

function counterpartyNameTokens(desc: string): Set<string> {
  const name = desc
    .replace(/^transferencia\s+(a|de)\s*/i, '')
    .replace(/^traspaso\s+(a|de):?\s*/i, '')
    .split('·')[0]
    .replace(/\(.*\)\s*$/, '')

  const normalized = stripAccents(name).toLowerCase().replace(/[^a-z0-9\s]/g, '')
  return new Set(normalized.split(/\s+/).filter((t) => t.length > 0))
}

function namesMatchAllowingAbbreviation(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false
  const [small, big] = a.size <= b.size ? [a, b] : [b, a]
  const bigTokens = [...big]
  return [...small].every((token) => big.has(token) || bigTokens.some((other) => {
    const [short, long] = token.length <= other.length ? [token, other] : [other, token]
    return short.length >= MIN_NAME_PREFIX_LENGTH && long.startsWith(short)
  }))
}

function sameTransferCounterparty(a: string, b: string): boolean {
  if (!TRANSFER_RE.test(a) && !TRANSFER_RE.test(b)) return false
  return namesMatchAllowingAbbreviation(counterpartyNameTokens(a), counterpartyNameTokens(b))
}

function isSameBankMovement(description: string, existingDescription: string | null): boolean {
  if (!existingDescription) return false
  return sameCompactDescription(description, existingDescription) || sameTransferCounterparty(description, existingDescription)
}

function nextIsoDay(isoDate: string): string {
  const next = new Date(isoDate)
  next.setDate(next.getDate() + 1)
  return next.toISOString().split('T')[0]
}

function settledOnOrDatedOnWhenUnsettled(isoDate: string): string {
  return `bank_settlement_date.eq.${isoDate},and(bank_settlement_date.is.null,date.gte.${isoDate},date.lt.${nextIsoDay(isoDate)})`
}

async function duplicateReason(client: Client, userId: string, isoDate: string, amount: number, description: string): Promise<DuplicateReason | null> {
  const { data: importedRows, error: importedError } = await client
    .from('transactions')
    .select('id, bank_description')
    .eq('user_id', userId)
    .eq('amount', amount)
    .not('bank_description', 'is', null)
    .or(settledOnOrDatedOnWhenUnsettled(isoDate))
    .limit(BANK_ROWS_TO_COMPARE)
  if (importedError) throw importedError
  if (importedRows?.some((row) => isSameBankMovement(description, row.bank_description))) return 'bank_duplicate'

  const { data: manualRows, error: manualError } = await client
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .gte('date', isoDate)
    .lt('date', nextIsoDay(isoDate))
    .eq('amount', amount)
    .is('bank_description', null)
    .limit(1)
  if (manualError) throw manualError
  return manualRows?.length ? 'manual_duplicate' : null
}

export function convertDate(dateStr: string, fallbackDate: string): string {
  if (dateStr.toLowerCase() === 'pendiente') return fallbackDate
  const parts = dateStr.split('-')
  if (parts[0].length === 4) return dateStr
  const [dd, mm, yyyy] = parts
  return `${yyyy}-${mm}-${dd}`
}

export async function insertBankMovement(
  client: Client,
  userId: string,
  m: { isoDate: string; description: string; type: string; amount: number; card?: string },
): Promise<{ id: string | null; error: unknown; category: string }> {
  const isCardPayment = isCardPaymentText(m.type, m.description)
  const category = isCardPayment ? CARD_PAYMENT_CATEGORY : UNCATEGORIZED
  const cardId = await cardForMovement(client, userId, {
    isCardPayment,
    lastFour: m.card ? m.card.replace(/\*/g, '') : null,
    texts: [m.description],
  })

  const { data: inserted, error } = await client
    .from('transactions')
    .insert({
      user_id: userId,
      date: `${m.isoDate}T${new Date().toISOString().slice(11, 19)}`,
      import_source: 'bank-sync',
      detail: `${BANK_IMPORT_MARK} ${m.description}`,
      bank_description: m.description,
      type: m.type,
      amount: m.amount,
      category_name: category,
      card_id: cardId,
      installment_id: null,
      reimbursement_for_category: null,
    })
    .select('id')
    .single()
  return { id: inserted?.id ?? null, error, category }
}

export async function emailBatchToUser(userId: string, bank: string, transactions: ImportedItem[]) {
  const to = await userEmail(serviceClient(), userId)
  if (to) await sendBatchNotificationEmail({ to, bank, transactions })
}

function uniqueMovements(result: ScrapeResult): Movement[] {
  const seen = new Set<string>()
  return [
    ...(result.accounts ?? []).flatMap((a) => a.movements),
    ...(result.creditCards ?? []).flatMap((cc) => cc.movements ?? []),
  ].filter((m) => {
    const key = `${m.date}|${m.amount}|${m.description}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function importBankMovements(params: {
  supabaseClient: Client
  userId: string
  result: ScrapeResult
  trigger: 'manual' | 'cron'
  sendEmail: boolean
}): Promise<ImportResult> {
  const { supabaseClient: client, userId, result, sendEmail } = params
  const toAutoCategorize: BankCategorizeItem[] = []
  const importedItems: ImportedItem[] = []
  const skippedItems: SkippedItem[] = []
  const syncDate = new Date().toISOString().split('T')[0]

  for (const movement of uniqueMovements(result)) {
    const amount = Math.abs(movement.amount)
    const type = movement.amount > 0 ? 'Ingreso' : 'Gasto'
    const { description } = movement

    if (amount === 0) {
      skippedItems.push({ date: movement.date, description, amount, type, reason: 'zero_amount' })
      continue
    }

    const isoDate = convertDate(movement.date, syncDate)
    const reason = await duplicateReason(client, userId, isoDate, amount, description)
    if (reason) {
      skippedItems.push({ date: movement.date, description, amount, type, reason, card: movement.card })
      continue
    }

    const { id, error, category } = await insertBankMovement(client, userId, { isoDate, description, type, amount, card: movement.card })
    if (error) {
      console.error('No se pudo insertar el movimiento del', movement.date, error)
      continue
    }
    importedItems.push({ id: id!, date: movement.date, description, amount, type })
    if (category !== CARD_PAYMENT_CATEGORY) toAutoCategorize.push({ id: id!, detail: description, type })
  }

  await categorizeBankImport(client, toAutoCategorize, userId, { apiKey: Deno.env.get('AI_GATEWAY_API_KEY') ?? '' })

  if (sendEmail && importedItems.length > 0) {
    try {
      await emailBatchToUser(userId, result.bank ?? 'Banco', importedItems)
    } catch (error) {
      console.error('⚠️ Email notification error:', error)
    }
  }

  return { imported: importedItems.length, skipped: skippedItems.length, importedItems, skippedItems }
}
