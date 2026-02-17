// Edge Function para agregar transacciones rápidamente
// Recibe texto natural tipo "45000 sushi" y crea la transacción + auto-categoriza

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { EXTENDED_CATEGORY_KEYWORDS } from '../_shared/keywords-dictionary.ts'

interface QuickAddRequest {
  text: string
  type?: 'Gasto' | 'Ingreso' | 'Inversión'
  // Auth via email/password (for Apple Shortcuts, etc.)
  email?: string
  password?: string
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function parseInput(input: string): { amount: number; detail: string | null } | null {
  const cleaned = input.trim()
  const match = cleaned.match(/^\$?\s*([\d.,]+)\s*(.*)/)
  if (!match) return null

  const amountStr = match[1].replace(/[.,]/g, "")
  const amount = parseInt(amountStr, 10)
  if (isNaN(amount) || amount <= 0) return null

  const detail = match[2]?.trim() || null
  return { amount, detail }
}

function calculateKeywordScore(text: string, keywords: string[]): number {
  const normalizedText = normalizeText(text)
  const words = normalizedText.split(" ")

  let score = 0
  let hasExactMatch = false

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword)

    if (normalizedText.includes(normalizedKeyword)) {
      score += 20
      hasExactMatch = true
      continue
    }

    const keywordWords = normalizedKeyword.split(" ")
    let wordMatches = 0
    let significantMatches = 0

    for (const kw of keywordWords) {
      if (kw.length <= 2) continue

      const hasMatch = words.some(w => {
        if (w === kw) return true
        if (kw.length >= 4 && w.length >= 4) {
          const matchLen = Math.min(kw.length, w.length)
          const maxLen = Math.max(kw.length, w.length)
          if (w.startsWith(kw) || kw.startsWith(w)) {
            return matchLen / maxLen > 0.7
          }
        }
        return false
      })

      if (hasMatch) {
        wordMatches++
        if (kw.length > 4) significantMatches++
      }
    }

    if (wordMatches === keywordWords.length && wordMatches > 0) {
      score += significantMatches > 0 ? 8 : 4
    } else if (significantMatches > 0) {
      score += 1
    }
  }

  if (hasExactMatch) {
    score *= 1.5
  }

  return Math.floor(score)
}

async function autoCategorize(
  supabaseClient: ReturnType<typeof createClient>,
  transactionId: string,
  detail: string,
  userId: string,
  existingCategories: string[]
): Promise<{ category: string; method: string; confidence: number }> {
  const normalizedDetail = normalizeText(detail)
  const words = normalizedDetail.split(" ")

  // 1. Historical patterns
  const { data: historicalTxs } = await supabaseClient
    .from('transactions')
    .select('category_name, detail')
    .eq('user_id', userId)
    .neq('category_name', 'Sin categoría')
    .not('detail', 'is', null)
    .limit(100)

  const historicalCounts: Record<string, number> = {}

  if (historicalTxs) {
    for (const tx of historicalTxs) {
      if (!tx.detail) continue
      const txNormalized = normalizeText(tx.detail)

      let similarity = 0
      for (const word of words) {
        if (word.length > 2 && txNormalized.includes(word)) {
          similarity++
        }
      }

      if (similarity >= 2 || similarity / words.length > 0.6) {
        historicalCounts[tx.category_name] = (historicalCounts[tx.category_name] || 0) + 1
      }
    }
  }

  let bestHistoricalCategory: string | null = null
  let maxCount = 0
  for (const [category, count] of Object.entries(historicalCounts)) {
    if (count > maxCount) {
      bestHistoricalCategory = category
      maxCount = count
    }
  }

  if (bestHistoricalCategory && maxCount >= 2) {
    await supabaseClient
      .from('transactions')
      .update({ category_name: bestHistoricalCategory })
      .eq('id', transactionId)

    return {
      category: bestHistoricalCategory,
      method: 'historical',
      confidence: Math.min(90, 60 + maxCount * 10)
    }
  }

  // 2. Keywords
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
    await supabaseClient
      .from('transactions')
      .update({ category_name: finalCategory })
      .eq('id', transactionId)

    return {
      category: finalCategory,
      method: 'keywords',
      confidence: Math.min(95, bestScore * 5)
    }
  }

  return { category: 'Sin categoría', method: 'none', confidence: 0 }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as QuickAddRequest
    const { text, type = 'Gasto', email, password } = body

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    let supabaseClient: ReturnType<typeof createClient>
    let userId: string

    if (email && password) {
      // Auth via email/password (Apple Shortcuts, HTTP clients, etc.)
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
      const { data: authData, error: signInError } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError || !authData.user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Email o contraseña incorrectos' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      userId = authData.user.id

      // Re-create client with the session token for RLS
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: { Authorization: `Bearer ${authData.session!.access_token}` },
        },
      })
    } else {
      // Auth via Bearer token (Raycast, web app, etc.)
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: 'No autorizado. Envía email+password o un Bearer token.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: { Authorization: authHeader },
        },
      })

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Token inválido o expirado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      userId = user.id
    }

    // Parse input
    const parsed = parseInput(text)
    if (!parsed) {
      return new Response(
        JSON.stringify({ success: false, error: 'Formato inválido. Usa: "45000 sushi" o "$12000 uber"' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const willAnalyze = parsed.detail && parsed.detail.length >= 3

    // Get user categories for auto-categorization
    let categoryNames: string[] = []
    if (willAnalyze) {
      const { data: categories } = await supabaseClient
        .from('categories')
        .select('name')
        .eq('user_id', userId)
      categoryNames = categories?.map(c => c.name) ?? []
    }

    // Insert transaction
    const { data: transaction, error: insertError } = await supabaseClient
      .from('transactions')
      .insert({
        amount: parsed.amount,
        type,
        category_name: willAnalyze ? '⚡ Analizando...' : 'Sin categoría',
        detail: parsed.detail,
        date: new Date().toISOString(),
        user_id: userId,
        card_id: null,
        installment_id: null,
      })
      .select()
      .single()

    if (insertError) {
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Auto-categorize if detail is long enough
    let categorization = null
    if (willAnalyze && transaction?.id) {
      categorization = await autoCategorize(
        supabaseClient,
        transaction.id,
        parsed.detail!,
        userId,
        categoryNames
      )
    }

    const formatted = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(parsed.amount)

    return new Response(
      JSON.stringify({
        success: true,
        transaction: {
          id: transaction.id,
          amount: parsed.amount,
          amountFormatted: formatted,
          type,
          detail: parsed.detail,
          category: categorization?.category ?? (willAnalyze ? '⚡ Analizando...' : 'Sin categoría'),
        },
        categorization,
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
