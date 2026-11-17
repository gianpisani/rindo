// Ingesta de un movimiento individual: insertarlo, categorizarlo por historial y
// avisar al usuario (push + email con el resumen semanal).
// Lo usan process-email-v2 y process-ios-wallet-push-notification: cada función
// solo parsea su entrada y arma la fila.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { sendNotificationEmail } from './email-notification.ts'

// deno-lint-ignore no-explicit-any
type Client = SupabaseClient<any, any, any>

/** Columnas que se insertan tal cual en `transactions` (card_id lo agrega la ingesta). */
export interface TransactionRow {
  user_id: string
  date: string
  type: 'Gasto' | 'Ingreso'
  amount: number
  detail: string
  import_source: 'email' | 'wallet'
  bank_description: string
  bank_settlement_date?: string | null
}

export interface WeeklyStats {
  dailyTotals: { date: string; day: string; total: number }[]
  top3: { detail: string; amount: number }[]
  weekTotal: number
  count: number
}

/**
 * Categoriza el movimiento por historial, lo inserta y avisa por push y email.
 * Lanza el error de Supabase si el insert falla; categorizar y avisar nunca lanzan.
 */
export async function ingestTransaction(client: Client, row: TransactionRow, options: {
  /** Banco que se muestra en el email. */
  bank: string
  /** Tag de la push (agrupa notificaciones del mismo origen). */
  pushTag: string
  /** Últimos 4 dígitos para asociar la tarjeta de crédito. */
  cardLastFour?: string | null
}) {
  const userId = row.user_id
  const { cardLastFour } = options

  // Match credit card by last 4 digits
  let cardId: string | null = null
  if (cardLastFour) {
    try {
      const { data: card } = await client
        .from('credit_cards')
        .select('id')
        .eq('user_id', userId)
        .eq('last_4_digits', cardLastFour)
        .eq('is_active', true)
        .maybeSingle()

      if (card) {
        cardId = card.id
        console.log(`💳 Tarjeta matched: ****${cardLastFour} → ${card.id}`)
      }
    } catch (e) {
      console.error('⚠️ Card match error:', e)
    }
  }

  const category = await categoryFromHistory(client, userId, row.detail)

  const { data: transaction, error } = await client
    .from('transactions')
    .insert({ ...row, category_name: category, card_id: cardId })
    .select()
    .single()

  if (error) {
    console.error('❌ Error al crear transacción:', error)
    throw error
  }

  console.log('✅ Transacción creada:', transaction.id, row.detail, row.amount)

  const weeklyStats = await weeklyCategoryStats(client, row, category)
  await sendPush(row, options.pushTag)
  await sendEmail(client, row, category, options.bank, weeklyStats)

  return { id: transaction.id as string, category, weeklyStats }
}

/**
 * Categoría por historial: la más repetida entre los últimos movimientos del
 * usuario cuyo detalle contiene la primera palabra de este. Igual que en
 * producción hoy; no usa Jev (eso queda para cuando estos importadores tengan auth).
 */
async function categoryFromHistory(client: Client, userId: string, detail: string): Promise<string> {
  try {
    const searchTerm = detail.replace(/^[🤖📱]\s*/u, '').split(/[\s(]/)[0]
    if (!searchTerm || searchTerm.length <= 2 || /^transferencia$/i.test(searchTerm)) return 'Sin categoría'

    const { data: similar } = await client
      .from('transactions')
      .select('category_name')
      .eq('user_id', userId)
      .neq('category_name', 'Sin categoría')
      .neq('category_name', '⚡ Analizando...')
      .ilike('detail', `%${searchTerm}%`)
      .limit(5)

    const counts: Record<string, number> = {}
    for (const tx of similar ?? []) counts[tx.category_name] = (counts[tx.category_name] || 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Sin categoría'
  } catch (e) {
    console.error('⚠️ Auto-categorize error:', e)
    return 'Sin categoría'
  }
}

// ── Notificaciones ──────────────────────────────────────────────────

/** Gasto diario de los últimos 7 días en la categoría del movimiento, para el email. */
async function weeklyCategoryStats(client: Client, row: TransactionRow, category: string): Promise<WeeklyStats | null> {
  try {
    const now = new Date(row.date)
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 6)
    const weekAgoStr = weekAgo.toISOString().split('T')[0]

    const { data: weekTxns } = await client
      .from('transactions')
      .select('date, amount, detail')
      .eq('user_id', row.user_id)
      .eq('category_name', category)
      .eq('type', row.type)
      .gte('date', weekAgoStr)
      .order('amount', { ascending: false })

    if (!weekTxns || weekTxns.length === 0) return null

    const dailyTotals: WeeklyStats['dailyTotals'] = []
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const dayTotal = weekTxns
        .filter(t => t.date.startsWith(dateStr))
        .reduce((sum, t) => sum + t.amount, 0)
      dailyTotals.push({ date: dateStr, day: dayNames[d.getDay()], total: dayTotal })
    }

    const top3 = weekTxns.slice(0, 3).map(t => ({
      detail: t.detail.replace(/^[🤖📱]\s*/u, ''),
      amount: t.amount,
    }))

    const weekTotal = weekTxns.reduce((sum, t) => sum + t.amount, 0)
    return { dailyTotals, top3, weekTotal, count: weekTxns.length }
  } catch (e) {
    console.error('⚠️ Weekly stats error:', e)
    return null
  }
}

async function sendPush(row: TransactionRow, tag: string) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const emoji = row.type === 'Ingreso' ? '💰' : '💳'
    const formatted = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(row.amount)

    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        userId: row.user_id,
        notification: {
          title: `${emoji} ${row.type}: ${formatted}`,
          body: row.detail,
          tag,
          requireInteraction: true,
        },
      }),
    })
  } catch (pushError) {
    console.error('⚠️ Push notification error:', pushError)
  }
}

async function sendEmail(client: Client, row: TransactionRow, category: string, bank: string, weeklyStats: WeeklyStats | null) {
  try {
    const { data: userData } = await client.auth.admin.getUserById(row.user_id)
    const userEmail = userData?.user?.email
    if (userEmail) {
      await sendNotificationEmail({
        to: userEmail,
        amount: row.amount,
        detail: row.detail,
        category,
        bank,
        type: row.type,
        weeklyStats,
      })
    } else {
      console.warn('⚠️ No email found for user', row.user_id)
    }
  } catch (emailError) {
    console.error('⚠️ Email notification error:', emailError)
  }
}
