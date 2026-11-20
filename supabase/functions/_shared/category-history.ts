import { stripAccents } from './text.ts'

export interface CategoryHistoryEntry {
  id?: string
  detail: string | null
  bank_description?: string | null
  type: string
  category_name: string
  category_source?: string | null
}

const MAX_RELEVANT_EXAMPLES = 12
const MAX_EXAMPLES_WITH_CATEGORY_VOCABULARY = 24
const EXACT_MERCHANT_BONUS = 20
const MAX_EXAMPLE_LENGTH = 240

export const stopWords = new Set(['a', 'de', 'del', 'el', 'la', 'las', 'los', 'en', 'por', 'para', 'con', 'un', 'una', 'pago', 'compra', 'transferencia', 'tarjeta', 'credito', 'debito', 'spa', 'sa', 'clp'])

export function normalizeMerchant(detail: string) {
  return stripAccents(detail).toLowerCase()
    .replace(/\*{2,}\d+/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

const tokens = (detail: string) => new Set(normalizeMerchant(detail).split(' ').filter(word => word.length > 1 && !stopWords.has(word)))

const withoutCardNumber = (detail: string) => detail.replace(/\(?\*{2,}\d+\)?/g, '').trim().slice(0, MAX_EXAMPLE_LENGTH)

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
    const score = (normalized === normalizeMerchant(detail) ? EXACT_MERCHANT_BONUS : 0) + weight * overlap.length / Math.max(query.size, words.size, 1)
    const existing = grouped.get(key)
    if (existing) existing.occurrences++
    else grouped.set(key, { detail: withoutCardNumber(row.detail!), category: row.category_name, occurrences: 1, score, source })
  })
  const sorted = [...grouped.values()].sort((a, b) => b.score - a.score || Number(b.source === 'manual') - Number(a.source === 'manual') || b.occurrences - a.occurrences)
  const selected = sorted.filter(item => item.score > 0).slice(0, MAX_RELEVANT_EXAMPLES)
  for (const category of categories) {
    if (selected.length >= MAX_EXAMPLES_WITH_CATEGORY_VOCABULARY) break
    const example = sorted.find(item => item.category === category)
    if (example && !selected.includes(example)) selected.push(example)
  }
  return selected.map(({ detail, category, occurrences, source }) => ({ detail, category, occurrences, source }))
}
