/**
 * Sistema de categorización automática de transacciones
 * Usa keywords, patrones históricos y machine learning básico
 */

import { supabase } from "@/integrations/supabase/client";
import { EXTENDED_CATEGORY_KEYWORDS } from "./keywords-dictionary";

// Usar el diccionario épico importado
const CATEGORY_KEYWORDS = EXTENDED_CATEGORY_KEYWORDS;

// Mapeo de categorías a tipos
const CATEGORY_TYPES: Record<string, "Ingreso" | "Gasto" | "Inversión"> = {
  "Comida": "Gasto",
  "Transporte": "Gasto",
  "Viajes y hospedaje": "Gasto",
  "Ocio y entretenimiento": "Gasto",
  "Compras personales": "Gasto",
  "Regalos": "Gasto",
  "Salud": "Gasto",
  "Educación": "Gasto",
  "Tecnología": "Gasto",
  "Servicios financieros": "Gasto",
  "Varios": "Gasto",
  
  "Sueldo": "Ingreso",
  "Reembolsos": "Ingreso",
  "Otros ingresos": "Ingreso",
  
  "Fintual Risk": "Inversión",
  "Fintual Moderado": "Inversión",
  "Inversiones": "Inversión",
};

interface CategorizationResult {
  category: string | null;
  type: "Ingreso" | "Gasto" | "Inversión" | null;
  confidence: number; // 0-100
  reasons: string[];
}

/**
 * Normaliza un string para comparación (lowercase, sin tildes, sin caracteres especiales)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calcula el score de match entre un texto y una lista de keywords
 */
function calculateKeywordScore(text: string, keywords: string[]): number {
  const normalizedText = normalizeText(text);
  const words = normalizedText.split(" ");
  
  let score = 0;
  let hasExactMatch = false;
  const matches: string[] = [];
  
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    const keywordWords = normalizedKeyword.split(" ");
    
    // Match exacto de keyword completo en el texto
    if (normalizedText.includes(normalizedKeyword)) {
      // Match exacto vale MUCHO más
      score += 20;
      hasExactMatch = true;
      matches.push(keyword);
      continue;
    }
    
    // Match de palabras individuales - SOLO si la palabra es significativa (> 3 chars)
    let wordMatches = 0;
    let significantMatches = 0;
    
    for (const kw of keywordWords) {
      // Ignorar palabras muy cortas que dan falsos positivos
      if (kw.length <= 2) continue;
      
      const hasMatch = words.some(w => {
        // Match exacto de palabra
        if (w === kw) return true;
        
        // Match parcial SOLO si es > 4 caracteres y el match es > 70%
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
    
    // Todas las palabras significativas del keyword coinciden
    if (wordMatches === keywordWords.length && wordMatches > 0) {
      score += significantMatches > 0 ? 8 : 4;
      matches.push(keyword);
    }
    // Match parcial - dar puntos muy bajos
    else if (significantMatches > 0) {
      score += 1; // Muy poco peso para matches parciales
    }
  }
  
  // Si hubo match exacto, multiplicar score para priorizarlo fuertemente
  if (hasExactMatch) {
    score *= 1.5;
  }
  
  return Math.floor(score);
}

/**
 * Busca patrones en transacciones históricas del usuario
 */
async function findHistoricalPatterns(detail: string, userId: string): Promise<{
  category: string | null;
  count: number;
}> {
  try {
    const normalizedDetail = normalizeText(detail);
    const words = normalizedDetail.split(" ");
    
    // Buscar transacciones similares (con las mismas palabras clave)
    const { data, error } = await supabase
      .from("transactions")
      .select("category_name, detail")
      .eq("user_id", userId)
      .not("category_name", "is", null)
      .not("detail", "is", null);
    
    if (error || !data) return { category: null, count: 0 };
    
    // Contar matches por categoría
    const categoryCounts: Record<string, number> = {};
    
    for (const tx of data) {
      if (!tx.detail) continue;
      
      const txNormalized = normalizeText(tx.detail);
      
      // Calcular similitud
      let similarity = 0;
      for (const word of words) {
        if (word.length > 2 && txNormalized.includes(word)) {
          similarity++;
        }
      }
      
      // Si hay al menos 2 palabras en común o similitud > 60%
      if (similarity >= 2 || similarity / words.length > 0.6) {
        categoryCounts[tx.category_name] = (categoryCounts[tx.category_name] || 0) + 1;
      }
    }
    
    // Encontrar la categoría con más matches
    let maxCategory: string | null = null;
    let maxCount = 0;
    
    for (const [category, count] of Object.entries(categoryCounts)) {
      if (count > maxCount) {
        maxCategory = category;
        maxCount = count;
      }
    }
    
    return { category: maxCategory, count: maxCount };
  } catch (error) {
    console.error("Error finding historical patterns:", error);
    return { category: null, count: 0 };
  }
}

/**
 * Categoriza una transacción basándose en su detalle
 * @param detail - Descripción de la transacción
 * @param userId - ID del usuario
 * @param existingCategories - Categorías existentes del usuario para priorizar matches exactos
 */
export async function categorizeTransaction(
  detail: string,
  userId: string,
  existingCategories?: string[]
): Promise<CategorizationResult> {
  if (!detail || detail.trim().length === 0) {
    return {
      category: null,
      type: null,
      confidence: 0,
      reasons: ["No hay detalle para categorizar"],
    };
  }
  
  const reasons: string[] = [];
  let bestCategory: string | null = null;
  let bestScore = 0;
  
  // 1. Buscar en patrones históricos
  const historical = await findHistoricalPatterns(detail, userId);
  
  if (historical.category && historical.count >= 2) {
    reasons.push(`Categorizado como "${historical.category}" basado en ${historical.count} transacciones similares previas`);
    return {
      category: historical.category,
      type: CATEGORY_TYPES[historical.category] || null,
      confidence: Math.min(90, 60 + historical.count * 10),
      reasons,
    };
  } else if (historical.category && historical.count === 1) {
    reasons.push(`Encontrada 1 transacción similar categorizada como "${historical.category}"`);
  }
  
  // 2. Buscar en keywords, priorizando categorías existentes del usuario
  const categoryScores: Record<string, { score: number; hasExactMatch: boolean }> = {};
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const normalizedText = normalizeText(detail);
    let score = 0;
    let hasExactMatch = false;
    
    // Verificar si hay algún match exacto de keyword
    for (const keyword of keywords) {
      const normalizedKeyword = normalizeText(keyword);
      if (normalizedText.includes(normalizedKeyword)) {
        hasExactMatch = true;
        break;
      }
    }
    
    score = calculateKeywordScore(detail, keywords);
    
    if (score > 0) {
      categoryScores[category] = { score, hasExactMatch };
    }
  }
  
  // PASO 1: Priorizar categorías con matches exactos
  const categoriesWithExactMatch = Object.entries(categoryScores)
    .filter(([_, data]) => data.hasExactMatch)
    .sort((a, b) => b[1].score - a[1].score);
  
  // PASO 2: Si hay matches exactos, usar solo esos (ignorar matches parciales de otras categorías)
  const candidateCategories = categoriesWithExactMatch.length > 0 
    ? categoriesWithExactMatch 
    : Object.entries(categoryScores).sort((a, b) => b[1].score - a[1].score);
  
  // PASO 3: Si hay categorías existentes del usuario, dar boost MODERADO solo si también tienen match exacto
  if (existingCategories && existingCategories.length > 0 && candidateCategories.length > 0) {
    // Solo aplicar boost si la categoría del usuario TAMBIÉN tiene match exacto
    for (let i = 0; i < candidateCategories.length; i++) {
      const [category, data] = candidateCategories[i];
      
      // Buscar match exacto o similar en categorías existentes
      const existingMatch = existingCategories.find(
        existing => 
          existing.toLowerCase() === category.toLowerCase() ||
          normalizeText(existing) === normalizeText(category)
      );
      
      if (existingMatch && data.hasExactMatch) {
        // Boost MODERADO para categorías que el usuario ya tiene Y tienen match exacto
        // No sobrescribir matches exactos más fuertes con categorías débiles del usuario
        data.score += 15;
        
        // Si esta es la mejor con boost, usarla
        if (i === 0 || data.score > candidateCategories[0][1].score) {
          bestCategory = existingMatch;
          bestScore = data.score;
        }
      }
    }
  }
  
  // PASO 4: Si no encontramos con boost, usar el mejor candidato
  if (!bestCategory && candidateCategories.length > 0) {
    const [category, data] = candidateCategories[0];
    bestCategory = category;
    bestScore = data.score;
  }
  
  if (bestCategory && bestScore > 0) {
    const confidence = Math.min(95, bestScore * 5); // Cada 10 puntos = 50% confidence
    reasons.push(`Palabras clave coinciden con "${bestCategory}"`);
    
    // Si tenemos también match histórico pero con score menor, mencionarlo
    if (historical.category && historical.category !== bestCategory) {
      reasons.push(`Nota: también podrías considerar "${historical.category}" basado en historial`);
    }
    
    return {
      category: bestCategory,
      type: CATEGORY_TYPES[bestCategory] || null,
      confidence,
      reasons,
    };
  }
  
  // 3. No se encontró categorización
  if (historical.category) {
    reasons.push(`Sugerencia débil: "${historical.category}" basado en 1 transacción similar`);
    return {
      category: historical.category,
      type: CATEGORY_TYPES[historical.category] || null,
      confidence: 30,
      reasons,
    };
  }
  
  return {
    category: null,
    type: null,
    confidence: 0,
    reasons: ["No se pudo categorizar automáticamente"],
  };
}

/**
 * Hook para debouncing - espera N ms después del último cambio antes de ejecutar
 */
export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(later, wait);
  };
}

