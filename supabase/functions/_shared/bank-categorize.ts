import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { categorizeBatchForUser } from './categorize.ts'
import { normalizeMerchant, stopWords } from './category-history.ts'

const UNCATEGORIZED = 'Sin categoría'

export interface BankCategorizeItem { id: string; detail: string; type: string }

// Bank prefixes that say how the money moved, not who received it.
const bankPrefixes = new Set(['traspaso', 'transf', 'nac', 'int', 'internacional', 'cargo', 'abono', 'cuota', 'cuotas', 'pac', 'pat'])

// First word that identifies the merchant. Bank descriptions often start with
// "COMPRA", "PAGO" or "TRASPASO", which would match unrelated movements.
export function merchantSearchTerm(detail: string): string | null {
  const word = normalizeMerchant(detail).split(' ')
    .find(w => w.length > 2 && !stopWords.has(w) && !bankPrefixes.has(w) && !/^\d+$/.test(w))
  return word ?? null
}

// Simple categorization: the category the user picked most often in their last
// movements of the same type whose detail contains the merchant word.
async function simpleCategoryFor(
  client: SupabaseClient, userId: string, item: BankCategorizeItem, batchIds: string[],
): Promise<string | null> {
  const term = merchantSearchTerm(item.detail)
  if (!term) return null
  const { data, error } = await client.from('transactions')
    .select('category_name')
    .eq('user_id', userId)
    .eq('type', item.type)
    .not('category_name', 'in', '("Sin categoría","⚡ Analizando...")')
    .not('id', 'in', `(${batchIds.join(',')})`)
    .ilike('detail', `%${term}%`)
    .order('created_at', { ascending: false })
    .limit(5)
  if (error || !data?.length) return null
  const counts = new Map<string, number>()
  for (const row of data as { category_name: string }[]) {
    counts.set(row.category_name, (counts.get(row.category_name) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

// Jev first; whatever it leaves uncategorized (timeout, provider error, crash)
// falls back to the simple history match. Never overwrites a category already set.
export async function categorizeBankImport(
  client: SupabaseClient, items: BankCategorizeItem[], userId: string, config: { apiKey: string },
) {
  if (!items.length) return
  const ids = items.map(item => item.id)
  let results: { transactionId: string; category: string }[] = []
  try {
    results = await categorizeBatchForUser(client, ids, userId, config)
  } catch {
    console.error('No se pudo categorizar la importación con Jev')
  }
  const categorized = new Set(results.filter(r => r.category !== UNCATEGORIZED).map(r => r.transactionId))
  const pending = items.filter(item => !categorized.has(item.id))

  let applied = 0
  for (const item of pending) {
    try {
      const category = await simpleCategoryFor(client, userId, item, ids)
      if (!category) continue
      const { data, error } = await client.from('transactions')
        .update({ category_name: category })
        .eq('id', item.id).eq('user_id', userId).eq('category_name', UNCATEGORIZED)
        .select('id')
      if (!error && data?.length) applied++
    } catch {
      console.error('No se pudo aplicar la categorización simple')
    }
  }
  console.log('Bank import categorization', { total: items.length, jev: categorized.size, fallbackPending: pending.length, fallbackApplied: applied })
}
