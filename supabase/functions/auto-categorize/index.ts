// Edge Function para auto-categorizar transacciones
// Usa algoritmo de keywords + historial (SIN IA externa, sin costos)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { EXTENDED_CATEGORY_KEYWORDS } from '../_shared/keywords-dictionary.ts'

interface CategorizationRequest {
  transactionId: string
  detail: string
  userId: string
  existingCategories: string[]
}

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

// Calcula score de match de keywords
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

    const { transactionId, detail, userId, existingCategories } = await req.json() as CategorizationRequest

    console.log('Auto-categorizando:', { transactionId, detail })

    // 1. Buscar patrones históricos
    const { data: historicalTxs } = await supabaseClient
      .from('transactions')
      .select('category_name, detail')
      .eq('user_id', userId)
      .neq('category_name', 'Sin categoría')
      .not('detail', 'is', null)
      .limit(100)

    const normalizedDetail = normalizeText(detail);
    const words = normalizedDetail.split(" ");
    
    // Contar matches por categoría en historial
    const historicalCounts: Record<string, number> = {};
    
    if (historicalTxs) {
      for (const tx of historicalTxs) {
        if (!tx.detail) continue;
        const txNormalized = normalizeText(tx.detail);
        
        let similarity = 0;
        for (const word of words) {
          if (word.length > 2 && txNormalized.includes(word)) {
            similarity++;
          }
        }
        
        if (similarity >= 2 || similarity / words.length > 0.6) {
          historicalCounts[tx.category_name] = (historicalCounts[tx.category_name] || 0) + 1;
        }
      }
    }
    
    // Si hay match histórico fuerte, usar eso
    let bestHistoricalCategory: string | null = null;
    let maxCount = 0;
    for (const [category, count] of Object.entries(historicalCounts)) {
      if (count > maxCount) {
        bestHistoricalCategory = category;
        maxCount = count;
      }
    }
    
    if (bestHistoricalCategory && maxCount >= 2) {
      // Actualizar transacción con patrón histórico
      await supabaseClient
        .from('transactions')
        .update({ category_name: bestHistoricalCategory })
        .eq('id', transactionId)
      
      console.log('Categorizado por historial:', bestHistoricalCategory, `(${maxCount} matches)`)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          category: bestHistoricalCategory,
          confidence: Math.min(90, 60 + maxCount * 10),
          method: 'historical'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Usar keywords
    const categoryScores: Record<string, { score: number; hasExactMatch: boolean }> = {};
    
    for (const [category, keywords] of Object.entries(EXTENDED_CATEGORY_KEYWORDS)) {
      const score = calculateKeywordScore(detail, keywords);
      
      if (score > 0) {
        const hasExactMatch = keywords.some(kw => 
          normalizedDetail.includes(normalizeText(kw))
        );
        categoryScores[category] = { score, hasExactMatch };
      }
    }
    
    // Priorizar matches exactos
    const candidateCategories = Object.entries(categoryScores)
      .filter(([_, data]) => data.hasExactMatch)
      .sort((a, b) => b[1].score - a[1].score);
    
    // Si hay categoría del usuario con match exacto, dar boost
    let finalCategory = 'Sin categoría';
    let bestScore = 0;
    
    if (candidateCategories.length > 0) {
      for (const [category, data] of candidateCategories) {
        const existingMatch = existingCategories.find(
          existing => normalizeText(existing) === normalizeText(category)
        );
        
        if (existingMatch && data.hasExactMatch) {
          data.score += 15;
          if (data.score > bestScore) {
            finalCategory = existingMatch;
            bestScore = data.score;
          }
        }
      }
      
      // Si no hay match con categorías del usuario, usar la mejor
      if (finalCategory === 'Sin categoría') {
        const [category] = candidateCategories[0];
        const existingMatch = existingCategories.find(
          existing => normalizeText(existing) === normalizeText(category)
        );
        if (existingMatch) {
          finalCategory = existingMatch;
          bestScore = candidateCategories[0][1].score;
        }
      }
    }
    
    // 3. Actualizar si encontramos categoría
    if (finalCategory !== 'Sin categoría') {
      await supabaseClient
        .from('transactions')
        .update({ category_name: finalCategory })
        .eq('id', transactionId)
      
      const confidence = Math.min(95, bestScore * 5);
      console.log('Categorizado por keywords:', finalCategory, `(${confidence}% confianza)`)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          category: finalCategory,
          confidence,
          method: 'keywords'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // No se pudo categorizar
    console.log('No se pudo categorizar, queda como "Sin categoría"')
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        category: 'Sin categoría',
        confidence: 0,
        method: 'none'
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

