import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { CATEGORIZABLE_TYPES, PENDING_CATEGORIES, PENDING_CATEGORIES_FILTER, UNCATEGORIZED } from './category-rules.ts'
import { historyContext, type CategoryHistoryEntry } from './category-history.ts'
import { classifyWithJev, type JevCategory } from './jev-categorizer.ts'

interface Config { apiKey: string; accessToken?: string }
interface UserContext { userId: string; categories: JevCategory[]; history: CategoryHistoryEntry[] }

const HISTORY_PAGE_SIZE = 1000
const HISTORY_MAX_ROWS = 10_000
const CONCURRENT_CLASSIFICATIONS = 4

export async function loadCategoryContext(client: SupabaseClient, userId: string): Promise<UserContext> {
  const { data: categories, error } = await client.from('categories').select('*').eq('user_id', userId)
  if (error) throw new Error('No se pudieron consultar las categorías')
  const history: CategoryHistoryEntry[] = []
  for (let offset = 0; offset < HISTORY_MAX_ROWS; offset += HISTORY_PAGE_SIZE) {
    const { data, error: historyError } = await client.from('transactions')
      .select(categories?.some(c => c.is_active !== undefined)
        ? 'id, detail, bank_description, type, category_name, category_source'
        : 'id, detail, bank_description, type, category_name').eq('user_id', userId)
      .not('category_name', 'in', PENDING_CATEGORIES_FILTER)
      .order('created_at', { ascending: false }).order('id').range(offset, offset + HISTORY_PAGE_SIZE - 1)
    if (historyError) throw new Error('No se pudo consultar el historial')
    history.push(...(data ?? []))
    if (!data || data.length < HISTORY_PAGE_SIZE) break
  }
  return { userId, categories: (categories ?? []).map(c => ({ id: c.id, name: c.name, type: c.type, description: c.description || undefined, is_active: c.is_active })), history }
}

export async function categorizeForUser(
  client: SupabaseClient, transactionId: string, userId: string, config: Config, context?: UserContext,
) {
  if (context && context.userId !== userId) throw new Error('Contexto de otro usuario')
  const { data: tx, error: txError } = await client.from('transactions')
    .select('id, detail, bank_description, type, category_name').eq('id', transactionId).eq('user_id', userId).single()
  if (txError || !tx) throw new Error('No se encontró el movimiento')
  if (!PENDING_CATEGORIES.includes(tx.category_name)) {
    return { success: true, applied: false, category: tx.category_name, method: 'manual', confidence: 0 }
  }
  if (!CATEGORIZABLE_TYPES.includes(tx.type)) {
    return { success: true, applied: false, category: tx.category_name, method: 'fixed', confidence: 0 }
  }
  const data = context ?? await loadCategoryContext(client, userId)
  const history = historyContext(tx.detail ?? tx.bank_description ?? '', tx.type, data.categories.filter(c => c.is_active !== false && c.type === tx.type).map(c => c.name), data.history, tx.id)
  const result = await classifyWithJev({ detail: tx.detail ?? tx.bank_description, type: tx.type }, data.categories, { ...config, history })
  let update = client.from('transactions').update({ category_name: result.category,
    ...(data.categories.some(c => c.is_active !== undefined) ? { category_source: result.status === 'accepted' ? 'jev' : null } : {}),
  })
    .eq('id', tx.id).eq('user_id', userId).eq('category_name', tx.category_name).eq('type', tx.type)
  update = tx.detail === null ? update.is('detail', null) : update.eq('detail', tx.detail)
  const { data: updated, error: updateError } = await update.select('id')
  if (updateError) throw new Error('No se pudo guardar la categoría')
  console.log('Jev categorization', { status: result.status, applied: Boolean(updated?.length), latencyMs: result.latencyMs, costUsd: result.costUsd, historyExamples: history.length })
  return { success: true, applied: Boolean(updated?.length), category: result.category, confidence: Math.round((result.confidence ?? 0) * 100), method: 'jev', decision: result }
}

export async function categorizeForSession(client: SupabaseClient, body: { transactionId?: string }, config: Config) {
  const { data: { user }, error: authError } = await client.auth.getUser(config.accessToken)
  if (authError || !user) throw new Error('Sesión inválida para categorizar')
  if (typeof body.transactionId !== 'string' || !body.transactionId) throw new Error('Falta el movimiento')
  return categorizeForUser(client, body.transactionId, user.id, config)
}

export async function categorizeBatchForUser(client: SupabaseClient, transactionIds: string[], userId: string, config: Config) {
  const historySnapshot = await loadCategoryContext(client, userId)
  const results = []
  for (let index = 0; index < transactionIds.length; index += CONCURRENT_CLASSIFICATIONS) {
    const chunk = await Promise.all(transactionIds.slice(index, index + CONCURRENT_CLASSIFICATIONS).map(async id => {
      try {
        return { transactionId: id, ...await categorizeForUser(client, id, userId, config, historySnapshot) }
      } catch (error) {
        console.error('No se pudo categorizar el movimiento', id, error)
        return { transactionId: id, success: false, applied: false, category: UNCATEGORIZED }
      }
    }))
    results.push(...chunk)
  }
  return results
}
