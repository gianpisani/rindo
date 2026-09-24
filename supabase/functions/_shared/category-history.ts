export interface CategoryHistoryEntry {
  id?: string
  detail: string | null
  bank_description?: string | null
  type: string
  category_name: string
  category_source?: string | null
}

const stopWords = new Set(['a', 'de', 'del', 'el', 'la', 'las', 'los', 'en', 'por', 'para', 'con', 'un', 'una', 'pago', 'compra', 'transferencia', 'tarjeta', 'credito', 'debito', 'spa', 'sa', 'clp'])
export function normalizeMerchant(detail: string) {
  return detail.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\*{2,}\d+/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}
const tokens = (detail: string) => new Set(normalizeMerchant(detail).split(' ').filter(word => word.length > 1 && !stopWords.has(word)))

// Rank across the user's history locally. Only bounded, relevant examples go
// to the model; no amounts, dates, account/card IDs, or database IDs are sent.
export function historyContext(detail: string, type: string, categories: string[], history: CategoryHistoryEntry[], excludeId?: string) {
  const allowed = new Set(categories)
  const rows = history.filter(row => (!excludeId || row.id !== excludeId) && row.type === type && allowed.has(row.category_name) && row.detail)
  const query = tokens(detail)
  const documents = rows.map(row => tokens(`${row.detail} ${row.bank_description ?? ''}`))
  const frequency = new Map<string, number>()
  for (const words of documents) for (const word of words) frequency.set(word, (frequency.get(word) ?? 0) + 1)
  const grouped = new Map<string, { detail: string; category: string; occurrences: number; score: number; source: 'manual' | 'jev' | 'unknown' }>()
  rows.forEach((row, index) => {
    const normalized = normalizeMerchant(row.detail!)
    const source = row.category_source === 'manual' || row.category_source === 'jev' ? row.category_source : 'unknown'
    const key = `${normalized}\u0000${row.category_name}\u0000${source}`
    const words = documents[index]
    const overlap = [...query].filter(word => words.has(word))
    const weight = overlap.reduce((sum, word) => sum + Math.log(1 + rows.length / (frequency.get(word) ?? 1)), 0)
    const score = (normalized === normalizeMerchant(detail) ? 20 : 0) + weight * overlap.length / Math.max(query.size, words.size, 1)
    const existing = grouped.get(key)
    if (existing) existing.occurrences++
    else grouped.set(key, { detail: row.detail!.replace(/\(?\*{2,}\d+\)?/g, '').trim().slice(0, 240), category: row.category_name, occurrences: 1, score, source })
  })
  const sorted = [...grouped.values()].sort((a, b) => b.score - a.score || Number(b.source === 'manual') - Number(a.source === 'manual') || b.occurrences - a.occurrences)
  const selected = sorted.filter(item => item.score > 0).slice(0, 12)
  // Include vocabulary examples for the user's categories when a merchant is new.
  for (const category of categories) {
    if (selected.length >= 24) break
    const example = sorted.find(item => item.category === category)
    if (example && !selected.includes(example)) selected.push(example)
  }
  return selected.map(({ detail, category, occurrences, source }) => ({ detail, category, occurrences, source }))
}
