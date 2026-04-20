// Edge Function para auto-categorizar transacciones
// Algoritmo de 3 capas: match exacto → fuzzy histórico → keywords
// SIN IA externa, sin costos

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { EXTENDED_CATEGORY_KEYWORDS } from '../_shared/keywords-dictionary.ts'

interface CategorizationRequest {
  transactionId: string
  detail: string
  userId: string
  existingCategories: string[]
}

interface BatchCategorizationRequest {
  transactions: { id: string; detail: string }[]
  userId: string
  existingCategories: string[]
}

interface CategorizationResult {
  transactionId: string
  category: string
  confidence: number
  method: string
}

// Categorías a ignorar en el historial
const IGNORED_CATEGORIES = ['Sin categoría', '⚡ Analizando...']

// Normaliza texto para comparación
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Tokeniza texto en palabras significativas (> 2 chars)
function tokenize(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(" ")
      .filter(w => w.length > 2)
  );
}

// Similaridad Jaccard entre dos strings tokenizados
function calculateJaccardSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

// Bonus por substring: detecta tokens principales contenidos en el otro
function calculateSubstringBonus(a: string, b: string): number {
  const tokensA = Array.from(tokenize(a));
  const tokensB = Array.from(tokenize(b));

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  let bonus = 0;

  // Solo considerar tokens largos (>= 4 chars) como significativos para substring
  const significantA = tokensA.filter(t => t.length >= 4);
  const significantB = tokensB.filter(t => t.length >= 4);

  for (const ta of significantA) {
    for (const tb of significantB) {
      if (ta === tb) continue; // ya cubierto por Jaccard
      if (ta.includes(tb) || tb.includes(ta)) {
        bonus += 0.15;
      }
    }
  }

  return Math.min(bonus, 0.3); // cap el bonus
}

// Peso por recencia: transacciones recientes valen más (decay en 365 días)
function recencyWeight(createdAt: string): number {
  const txDate = new Date(createdAt);
  const now = new Date();
  const daysDiff = (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff <= 0) return 1.0;
  if (daysDiff >= 365) return 0.5;

  // Decay lineal de 1.0 a 0.5 en 365 días
  return 1.0 - (daysDiff / 365) * 0.5;
}

// ═══════════════════════════════════════════════════════
// CAPA 1: Match exacto de detalle (confidence 95-98%)
// ═══════════════════════════════════════════════════════
async function findExactMatch(
  supabaseClient: SupabaseClient,
  userId: string,
  detail: string
): Promise<{ category: string; confidence: number; count: number } | null> {
  const { data: matches } = await supabaseClient
    .from('transactions')
    .select('category_name')
    .eq('user_id', userId)
    .ilike('detail', detail)
    .not('category_name', 'in', `(${IGNORED_CATEGORIES.join(',')})`)
    .limit(20)

  if (!matches || matches.length === 0) return null;

  // Contar frecuencia por categoría
  const counts: Record<string, number> = {};
  for (const m of matches) {
    counts[m.category_name] = (counts[m.category_name] || 0) + 1;
  }

  // Encontrar la categoría más frecuente
  let bestCategory = '';
  let maxCount = 0;
  for (const [cat, count] of Object.entries(counts)) {
    if (count > maxCount) {
      bestCategory = cat;
      maxCount = count;
    }
  }

  // Incluso 1 match exacto basta → confidence 95%
  // Más matches → hasta 98%
  const confidence = Math.min(98, 95 + maxCount);

  return { category: bestCategory, confidence, count: maxCount };
}

// ═══════════════════════════════════════════════════════
// CAPA 2: Match histórico fuzzy mejorado (confidence 50-90%)
// ═══════════════════════════════════════════════════════
interface FuzzyMatch {
  category: string
  confidence: number
  matchCount: number
  maxSimilarity: number
}

async function findFuzzyHistoricalMatch(
  supabaseClient: SupabaseClient,
  userId: string,
  detail: string
): Promise<FuzzyMatch | null> {
  const { data: historicalTxs } = await supabaseClient
    .from('transactions')
    .select('category_name, detail, created_at')
    .eq('user_id', userId)
    .not('category_name', 'in', `(${IGNORED_CATEGORIES.join(',')})`)
    .not('detail', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (!historicalTxs || historicalTxs.length === 0) return null;

  // Agregar scores por categoría
  const categoryStats: Record<string, {
    totalScore: number
    count: number
    maxSimilarity: number
  }> = {};

  for (const tx of historicalTxs) {
    if (!tx.detail) continue;

    const jaccard = calculateJaccardSimilarity(detail, tx.detail);
    const substringBonus = calculateSubstringBonus(detail, tx.detail);
    const baseSimilarity = Math.min(1.0, jaccard + substringBonus);

    // Umbral mínimo para considerar
    if (baseSimilarity < 0.3) continue;

    const recency = recencyWeight(tx.created_at);
    const weightedScore = baseSimilarity * recency;

    if (!categoryStats[tx.category_name]) {
      categoryStats[tx.category_name] = { totalScore: 0, count: 0, maxSimilarity: 0 };
    }

    const stats = categoryStats[tx.category_name];
    stats.totalScore += weightedScore;
    stats.count++;
    stats.maxSimilarity = Math.max(stats.maxSimilarity, baseSimilarity);
  }

  if (Object.keys(categoryStats).length === 0) return null;

  // Seleccionar mejor categoría con umbral adaptivo
  let bestCategory: string | null = null;
  let bestScore = 0;
  let bestMaxSim = 0;
  let bestCount = 0;

  for (const [category, stats] of Object.entries(categoryStats)) {
    // Umbral adaptivo:
    // - similarity > 0.7 con 1 match basta
    // - similarity > 0.4 necesita 2+ matches
    // - similarity <= 0.4 necesita 3+ matches
    const meetsThreshold =
      stats.maxSimilarity > 0.7 ||
      (stats.maxSimilarity > 0.4 && stats.count >= 2) ||
      (stats.maxSimilarity > 0.3 && stats.count >= 3);

    if (!meetsThreshold) continue;

    // Score compuesto: priorizar maxSimilarity, luego totalScore
    const compositeScore = stats.maxSimilarity * 2 + stats.totalScore;

    if (compositeScore > bestScore) {
      bestScore = compositeScore;
      bestCategory = category;
      bestMaxSim = stats.maxSimilarity;
      bestCount = stats.count;
    }
  }

  if (!bestCategory) return null;

  // Calcular confidence (50-90%)
  const simComponent = bestMaxSim * 50; // 0-50
  const countComponent = Math.min(20, bestCount * 5); // 0-20
  const confidence = Math.min(90, Math.floor(50 + simComponent * 0.6 + countComponent));

  return {
    category: bestCategory,
    confidence,
    matchCount: bestCount,
    maxSimilarity: bestMaxSim,
  };
}

// ═══════════════════════════════════════════════════════
// CAPA 3: Keywords fallback (confidence 30-70%)
// ═══════════════════════════════════════════════════════
function calculateKeywordScore(text: string, keywords: string[]): number {
  const normalizedText = normalizeText(text);
  const words = normalizedText.split(" ");

  let score = 0;
  let hasExactMatch = false;

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);

    // Match exacto vale mucho
    if (normalizedText.includes(normalizedKeyword)) {
      score += 20;
      hasExactMatch = true;
      continue;
    }

    // Match de palabras individuales
    const keywordWords = normalizedKeyword.split(" ");
    let wordMatches = 0;
    let significantMatches = 0;

    for (const kw of keywordWords) {
      if (kw.length <= 2) continue;

      const hasMatch = words.some(w => {
        if (w === kw) return true;
        if (kw.length >= 4 && w.length >= 4) {
          const matchLen = Math.min(kw.length, w.length);
          const maxLen = Math.max(kw.length, w.length);
          if (w.startsWith(kw) || kw.startsWith(w)) {
            return matchLen / maxLen > 0.7;
          }
        }
        return false;
      });

      if (hasMatch) {
        wordMatches++;
        if (kw.length > 4) significantMatches++;
      }
    }

    if (wordMatches === keywordWords.length && wordMatches > 0) {
      score += significantMatches > 0 ? 8 : 4;
    } else if (significantMatches > 0) {
      score += 1;
    }
  }

  if (hasExactMatch) {
    score *= 1.5;
  }

  return Math.floor(score);
}

// ═══════════════════════════════════════════════════════
// CORE: Categoriza 1 transacción usando las 3 capas
// ═══════════════════════════════════════════════════════
async function categorizeOne(
  supabaseClient: SupabaseClient,
  userId: string,
  transactionId: string,
  detail: string,
  existingCategories: string[],
  // Pre-fetched history for batch mode (skip individual DB queries)
  prefetchedHistory?: { category_name: string; detail: string; created_at: string }[] | null,
): Promise<CategorizationResult> {

  // ─── CAPA 1: Match exacto ───
  if (prefetchedHistory) {
    // Use prefetched data instead of DB query
    const normalizedDetail = normalizeText(detail)
    const counts: Record<string, number> = {}
    for (const tx of prefetchedHistory) {
      if (normalizeText(tx.detail) === normalizedDetail) {
        counts[tx.category_name] = (counts[tx.category_name] || 0) + 1
      }
    }
    const entries = Object.entries(counts)
    if (entries.length > 0) {
      const [bestCategory, maxCount] = entries.reduce((a, b) => b[1] > a[1] ? b : a)
      const confidence = Math.min(98, 95 + maxCount)
      console.log('✅ Capa 1 - Match exacto:', bestCategory, `(${maxCount} matches, ${confidence}% confianza)`)
      return { transactionId, category: bestCategory, confidence, method: 'exact_history' }
    }
  } else {
    const exactMatch = await findExactMatch(supabaseClient, userId, detail)
    if (exactMatch) {
      console.log('✅ Capa 1 - Match exacto:', exactMatch.category, `(${exactMatch.count} matches, ${exactMatch.confidence}% confianza)`)
      return { transactionId, category: exactMatch.category, confidence: exactMatch.confidence, method: 'exact_history' }
    }
  }

  // ─── CAPA 2: Match fuzzy histórico ───
  if (prefetchedHistory) {
    // Use prefetched data for fuzzy matching
    const categoryStats: Record<string, { totalScore: number; count: number; maxSimilarity: number }> = {}
    for (const tx of prefetchedHistory) {
      if (!tx.detail) continue
      const jaccard = calculateJaccardSimilarity(detail, tx.detail)
      const substringBonus = calculateSubstringBonus(detail, tx.detail)
      const baseSimilarity = Math.min(1.0, jaccard + substringBonus)
      if (baseSimilarity < 0.3) continue
      const recency = recencyWeight(tx.created_at)
      const weightedScore = baseSimilarity * recency
      if (!categoryStats[tx.category_name]) {
        categoryStats[tx.category_name] = { totalScore: 0, count: 0, maxSimilarity: 0 }
      }
      const stats = categoryStats[tx.category_name]
      stats.totalScore += weightedScore
      stats.count++
      stats.maxSimilarity = Math.max(stats.maxSimilarity, baseSimilarity)
    }

    let bestCategory: string | null = null
    let bestScore = 0
    let bestMaxSim = 0
    let bestCount = 0
    for (const [category, stats] of Object.entries(categoryStats)) {
      const meetsThreshold =
        stats.maxSimilarity > 0.7 ||
        (stats.maxSimilarity > 0.4 && stats.count >= 2) ||
        (stats.maxSimilarity > 0.3 && stats.count >= 3)
      if (!meetsThreshold) continue
      const compositeScore = stats.maxSimilarity * 2 + stats.totalScore
      if (compositeScore > bestScore) {
        bestScore = compositeScore
        bestCategory = category
        bestMaxSim = stats.maxSimilarity
        bestCount = stats.count
      }
    }
    if (bestCategory) {
      const simComponent = bestMaxSim * 50
      const countComponent = Math.min(20, bestCount * 5)
      const confidence = Math.min(90, Math.floor(50 + simComponent * 0.6 + countComponent))
      console.log('✅ Capa 2 - Match fuzzy:', bestCategory, `(${bestCount} matches, sim=${bestMaxSim.toFixed(2)}, ${confidence}% confianza)`)
      return { transactionId, category: bestCategory, confidence, method: 'fuzzy_history' }
    }
  } else {
    const fuzzyMatch = await findFuzzyHistoricalMatch(supabaseClient, userId, detail)
    if (fuzzyMatch) {
      console.log('✅ Capa 2 - Match fuzzy:', fuzzyMatch.category, `(${fuzzyMatch.matchCount} matches, sim=${fuzzyMatch.maxSimilarity.toFixed(2)}, ${fuzzyMatch.confidence}% confianza)`)
      return { transactionId, category: fuzzyMatch.category, confidence: fuzzyMatch.confidence, method: 'fuzzy_history' }
    }
  }

  // ─── CAPA 3: Keywords fallback ───
  const normalizedDetail = normalizeText(detail)
  const categoryScores: Record<string, { score: number; hasExactMatch: boolean }> = {}

  for (const [category, keywords] of Object.entries(EXTENDED_CATEGORY_KEYWORDS)) {
    const score = calculateKeywordScore(detail, keywords)
    if (score > 0) {
      const hasExactMatch = keywords.some(kw =>
        normalizedDetail.includes(normalizeText(kw))
      )
      categoryScores[category] = { score, hasExactMatch }
    }
  }

  const candidateCategories = Object.entries(categoryScores)
    .filter(([_, data]) => data.hasExactMatch)
    .sort((a, b) => b[1].score - a[1].score)

  let finalCategory = 'Sin categoría'
  let bestScore = 0

  if (candidateCategories.length > 0) {
    for (const [category, data] of candidateCategories) {
      const existingMatch = existingCategories.find(
        existing => normalizeText(existing) === normalizeText(category)
      )
      if (existingMatch && data.hasExactMatch) {
        data.score += 15
        if (data.score > bestScore) {
          finalCategory = existingMatch
          bestScore = data.score
        }
      }
    }

    if (finalCategory === 'Sin categoría') {
      const [category] = candidateCategories[0]
      const existingMatch = existingCategories.find(
        existing => normalizeText(existing) === normalizeText(category)
      )
      if (existingMatch) {
        finalCategory = existingMatch
        bestScore = candidateCategories[0][1].score
      }
    }
  }

  if (finalCategory !== 'Sin categoría') {
    const confidence = Math.min(70, 30 + bestScore * 2)
    console.log('✅ Capa 3 - Keywords:', finalCategory, `(${confidence}% confianza)`)
    return { transactionId, category: finalCategory, confidence, method: 'keywords' }
  }

  console.log('❌ No se pudo categorizar, queda como "Sin categoría"')
  return { transactionId, category: 'Sin categoría', confidence: 0, method: 'none' }
}

// ═══════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const body = await req.json()

    // ─── BATCH MODE: { transactions, userId, existingCategories } ───
    if (body.transactions && Array.isArray(body.transactions)) {
      const { transactions, userId, existingCategories = [] } = body as BatchCategorizationRequest

      console.log(`📦 Batch auto-categorize: ${transactions.length} transacciones`)

      // 1 solo query de historial para todas las transacciones
      const { data: history } = await supabaseClient
        .from('transactions')
        .select('category_name, detail, created_at')
        .eq('user_id', userId)
        .not('category_name', 'in', `(${IGNORED_CATEGORIES.join(',')})`)
        .not('detail', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500)

      const results: CategorizationResult[] = []
      const updates: { id: string; category_name: string }[] = []

      for (const tx of transactions) {
        const result = await categorizeOne(
          supabaseClient, userId, tx.id, tx.detail,
          existingCategories, history,
        )
        results.push(result)
        updates.push({ id: tx.id, category_name: result.category })
      }

      // Batch update todas las transacciones
      // Supabase no soporta bulk update nativo, usamos upsert por chunks
      const CHUNK_SIZE = 50
      for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE)
        await Promise.all(
          chunk.map(u =>
            supabaseClient
              .from('transactions')
              .update({ category_name: u.category_name })
              .eq('id', u.id)
          )
        )
      }

      const categorized = results.filter(r => r.method !== 'none').length
      console.log(`📦 Batch complete: ${categorized}/${transactions.length} categorizadas`)

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── SINGLE MODE: { transactionId, detail, userId, existingCategories } ───
    const { transactionId, detail, userId, existingCategories = [] } = body as CategorizationRequest

    console.log('Auto-categorizando:', { transactionId, detail })

    const result = await categorizeOne(
      supabaseClient, userId, transactionId, detail, existingCategories,
    )

    // Update en DB
    await supabaseClient
      .from('transactions')
      .update({ category_name: result.category })
      .eq('id', transactionId)

    return new Response(
      JSON.stringify({
        success: true,
        category: result.category,
        confidence: result.confidence,
        method: result.method,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
