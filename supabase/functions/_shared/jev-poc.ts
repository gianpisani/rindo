import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { classifyWithJev, type JevCategory } from './jev-categorizer.ts'
import { historyContext, type CategoryHistoryEntry } from './category-history.ts'

interface Config { apiKey: string; accessToken?: string }
interface UserContext { userId: string; categories: JevCategory[]; history: CategoryHistoryEntry[] }

export async function loadCategoryContext(client: SupabaseClient, userId: string): Promise<UserContext> {
  const { data: categories, error } = await client.from('categories').select('*').eq('user_id', userId)
  if (error) throw new Error('No se pudieron consultar las categorías')
  const history: CategoryHistoryEntry[] = []
  // Paginate past Supabase's default 1,000-row response limit. The 10k cap bounds
  // work for imports; all 800+ current movements fit without sampling them away.
  for (let offset = 0; offset < 10_000; offset += 1000) {
    const { data, error: historyError } = await client.from('transactions')
      .select(categories?.some(c => c.is_active !== undefined)
        ? 'id, detail, bank_description, type, category_name, category_source'
        : 'id, detail, bank_description, type, category_name').eq('user_id', userId)
      .not('category_name', 'in', '("Sin categoría","⚡ Analizando...")')
      .order('created_at', { ascending: false }).order('id').range(offset, offset + 999)
    if (historyError) throw new Error('No se pudo consultar el historial')
    history.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return { userId, categories: (categories ?? []).map(c => ({ id: c.id, name: c.name, type: c.type, description: c.description || undefined, is_active: c.is_active })), history }
}

// Only call from handlers that have already authenticated their user/job.
// Public HTTP callers use tryJevPoc below, never supply an arbitrary owner.
export async function categorizeForUser(
  client: SupabaseClient, transactionId: string, userId: string, config: Config, context?: UserContext,
) {
  if (context && context.userId !== userId) throw new Error('Contexto de otro usuario')
  const { data: tx, error: txError } = await client.from('transactions')
    .select('id, detail, bank_description, type, category_name').eq('id', transactionId).eq('user_id', userId).single()
  if (txError || !tx) throw new Error('No se encontró el movimiento')
  if (!['Sin categoría', '⚡ Analizando...'].includes(tx.category_name)) {
    return { success: true, applied: false, category: tx.category_name, method: 'manual', confidence: 0 }
  }
  if (!['Gasto', 'Ingreso', 'Inversión'].includes(tx.type)) {
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

export async function tryJevPoc(client: SupabaseClient, body: { transactionId?: string }, config: Config) {
  const { data: { user }, error: authError } = await client.auth.getUser(config.accessToken)
  if (authError || !user) throw new Error('Sesión inválida para categorizar')
  if (typeof body.transactionId !== 'string' || !body.transactionId) throw new Error('Falta el movimiento')
  return categorizeForUser(client, body.transactionId, user.id, config)
}

export async function categorizeBatchForUser(client: SupabaseClient, transactionIds: string[], userId: string, config: Config) {
  const context = await loadCategoryContext(client, userId)
  const results = []
  // One history snapshot per import prevents the batch teaching itself from its
  // own predictions. Bounded concurrency avoids a burst of model requests.
  for (let index = 0; index < transactionIds.length; index += 4) {
    const chunk = await Promise.all(transactionIds.slice(index, index + 4).map(async id => {
      try { return { transactionId: id, ...await categorizeForUser(client, id, userId, config, context) } }
      catch { return { transactionId: id, success: false, applied: false, category: 'Sin categoría' } }
    }))
    results.push(...chunk)
  }
  return results
}
