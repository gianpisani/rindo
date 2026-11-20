import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { categorizeBatchForUser } from './categorize.ts'
import { PENDING_CATEGORIES_FILTER, UNCATEGORIZED } from './category-rules.ts'
import { normalizeMerchant, stopWords } from './category-history.ts'
import { withoutImportMark } from './text.ts'

export interface BankCategorizeItem { id: string; detail: string; type: string }

const HISTORY_SAMPLE_SIZE = 5
const howMoneyMovedWords = new Set(['traspaso', 'transf', 'nac', 'int', 'internacional', 'cargo', 'abono', 'cuota', 'cuotas', 'pac', 'pat'])

export function merchantSearchTerm(detail: string): string | null {
  const word = normalizeMerchant(detail).split(' ')
    .find(w => w.length > 2 && !stopWords.has(w) && !howMoneyMovedWords.has(w) && !/^\d+$/.test(w))
  return word ?? null
}

const MIN_SEARCH_TERM_LENGTH = 3
const TRANSFER_WORD = /^transferencia$/i

export function firstWordSearchTerm(detail: string): string | null {
  const word = withoutImportMark(detail).split(/[\s(]/)[0]
  if (!word || word.length < MIN_SEARCH_TERM_LENGTH || TRANSFER_WORD.test(word)) return null
  return word
}

export async function mostCommonCategory(
  client: SupabaseClient, userId: string, term: string, filters: { type?: string; excludeIds?: string[] } = {},
): Promise<string | null> {
  let query = client.from('transactions')
    .select('category_name')
    .eq('user_id', userId)
    .not('category_name', 'in', PENDING_CATEGORIES_FILTER)
  if (filters.type) query = query.eq('type', filters.type)
  if (filters.excludeIds?.length) query = query.not('id', 'in', `(${filters.excludeIds.join(',')})`)
  const { data, error } = await query
    .ilike('detail', `%${term}%`)
    .order('created_at', { ascending: false })
    .limit(HISTORY_SAMPLE_SIZE)
  if (error) {
    console.error('No se pudo consultar el historial para categorizar:', error)
    return null
  }
  if (!data?.length) return null
  const counts = new Map<string, number>()
  for (const row of data as { category_name: string }[]) {
    counts.set(row.category_name, (counts.get(row.category_name) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

export function categoryFromHistory(
  client: SupabaseClient, userId: string, movement: { detail: string; type: string }, excludeIds: string[] = [],
): Promise<string | null> {
  const term = merchantSearchTerm(movement.detail)
  return term ? mostCommonCategory(client, userId, term, { type: movement.type, excludeIds }) : Promise.resolve(null)
}

async function applyHistoryCategory(client: SupabaseClient, userId: string, item: BankCategorizeItem, batchIds: string[]): Promise<boolean> {
  const category = await categoryFromHistory(client, userId, item, batchIds)
  if (!category) return false
  const { data, error } = await client.from('transactions')
    .update({ category_name: category })
    .eq('id', item.id).eq('user_id', userId).eq('category_name', UNCATEGORIZED)
    .select('id')
  if (error) {
    console.error('No se pudo aplicar la categoría por historial:', error)
    return false
  }
  return Boolean(data?.length)
}

export async function categorizeBankImport(
  client: SupabaseClient, items: BankCategorizeItem[], userId: string, config: { apiKey: string },
) {
  if (!items.length) return
  const ids = items.map(item => item.id)
  let jevResults: { transactionId: string; category: string }[] = []
  try {
    jevResults = await categorizeBatchForUser(client, ids, userId, config)
  } catch (error) {
    console.error('No se pudo categorizar la importación con Jev:', error)
  }
  const categorizedByJev = new Set(jevResults.filter(r => r.category !== UNCATEGORIZED).map(r => r.transactionId))
  const leftForHistory = items.filter(item => !categorizedByJev.has(item.id))

  let applied = 0
  for (const item of leftForHistory) {
    if (await applyHistoryCategory(client, userId, item, ids)) applied++
  }
  console.log('Bank import categorization', { total: items.length, jev: categorizedByJev.size, fallbackPending: leftForHistory.length, fallbackApplied: applied })
}
