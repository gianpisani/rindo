import { firstWordSearchTerm, mostCommonCategory } from './bank-categorize.ts'
import { CARD_PAYMENT_CATEGORY, cardForMovement, isCardPaymentText } from './card-payment.ts'
import { UNCATEGORIZED } from './category-rules.ts'
import { sendNotificationEmail, userEmail, type WeeklyStats } from './email-notification.ts'
import type { Client } from './supabase.ts'
import { withoutImportMark } from './text.ts'

interface TransactionRow {
  user_id: string
  date: string
  type: 'Gasto' | 'Ingreso'
  amount: number
  detail: string
  import_source: 'email' | 'wallet'
  bank_description: string
  bank_settlement_date?: string | null
}

interface IngestOptions {
  bank: string
  pushTag: string
  cardLastFour?: string | null
}

const WEEK_DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const TOP_OF_WEEK = 3

export async function ingestTransaction(client: Client, row: TransactionRow, options: IngestOptions) {
  const isCardPayment = isCardPaymentText(row.type, row.detail, row.bank_description)
  const cardId = await cardForMovement(client, row.user_id, {
    isCardPayment,
    lastFour: options.cardLastFour || null,
    texts: [row.detail, row.bank_description],
  })
  const searchTerm = firstWordSearchTerm(row.detail)
  const category = isCardPayment
    ? CARD_PAYMENT_CATEGORY
    : (searchTerm && await mostCommonCategory(client, row.user_id, searchTerm)) || UNCATEGORIZED

  const { data: transaction, error } = await client
    .from('transactions')
    .insert({ ...row, category_name: category, card_id: cardId })
    .select('id')
    .single()
  if (error) {
    console.error('❌ Error al crear transacción:', error)
    throw error
  }
  console.log('✅ Transacción creada:', transaction.id)

  const weeklyStats = await weeklyCategoryStats(client, row, category)
  await notifyByPush(row, options.pushTag)
  await notifyByEmail(client, row, category, options.bank, weeklyStats)

  return { id: transaction.id as string, category, weeklyStats }
}

const isoDay = (date: Date) => date.toISOString().split('T')[0]

async function weeklyCategoryStats(client: Client, row: TransactionRow, category: string): Promise<WeeklyStats | null> {
  const movementDay = new Date(row.date)
  const weekStart = new Date(movementDay)
  weekStart.setDate(weekStart.getDate() - 6)

  const { data: weekTxns, error } = await client
    .from('transactions')
    .select('date, amount, detail')
    .eq('user_id', row.user_id)
    .eq('category_name', category)
    .eq('type', row.type)
    .gte('date', isoDay(weekStart))
    .order('amount', { ascending: false })
  if (error) {
    console.error('⚠️ No se pudo calcular el resumen semanal:', error)
    return null
  }
  if (!weekTxns?.length) return null

  const dailyTotals: WeeklyStats['dailyTotals'] = []
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const day = new Date(movementDay)
    day.setDate(day.getDate() - daysAgo)
    const date = isoDay(day)
    const total = weekTxns.filter(t => t.date.startsWith(date)).reduce((sum, t) => sum + t.amount, 0)
    dailyTotals.push({ date, day: WEEK_DAY_NAMES[day.getDay()], total })
  }

  return {
    dailyTotals,
    top3: weekTxns.slice(0, TOP_OF_WEEK).map(t => ({ detail: withoutImportMark(t.detail), amount: t.amount })),
    weekTotal: weekTxns.reduce((sum, t) => sum + t.amount, 0),
    count: weekTxns.length,
  }
}

async function notifyByPush(row: TransactionRow, tag: string) {
  try {
    const formatted = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(row.amount)
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        userId: row.user_id,
        notification: {
          title: `${row.type === 'Ingreso' ? '💰' : '💳'} ${row.type}: ${formatted}`,
          body: row.detail,
          tag,
          requireInteraction: true,
        },
      }),
    })
    if (!res.ok) console.error('⚠️ send-push-notification respondió', res.status)
  } catch (error) {
    console.error('⚠️ Push notification error:', error)
  }
}

async function notifyByEmail(client: Client, row: TransactionRow, category: string, bank: string, weeklyStats: WeeklyStats | null) {
  try {
    const to = await userEmail(client, row.user_id)
    if (!to) {
      console.warn('⚠️ El usuario no tiene email', row.user_id)
      return
    }
    await sendNotificationEmail({ to, amount: row.amount, detail: row.detail, category, bank, type: row.type, weeklyStats })
  } catch (error) {
    console.error('⚠️ Email notification error:', error)
  }
}
