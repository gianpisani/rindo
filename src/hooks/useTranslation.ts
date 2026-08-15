import { useQuery } from "@tanstack/react-query";

// ── Traducción al español ───────────────────────────────────
//
// Dos fuentes gratis, sin API key y con CORS abierto. Se probaron tres:
// MyMemory quedó fuera porque traduce mal ("acknowledge" → "bloque de
// aceptado"). Google gtx acierta y es la más rápida; Lingva queda de respaldo.

const TIMEOUT_MS = 6000;

async function viaGoogle(text: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      "https://translate.googleapis.com/translate_a/single" +
        `?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(text)}`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as [[string, string][]];
    if (!Array.isArray(data?.[0])) return null;
    const joined = data[0].map((segment) => segment[0]).join("").trim();
    return joined || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function viaLingva(text: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://lingva.ml/api/v1/en/es/${encodeURIComponent(text)}`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { translation?: string };
    return data.translation?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function translateOne(text: string): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return (await viaGoogle(trimmed)) ?? (await viaLingva(trimmed));
}

/** Sin duplicados y en orden estable, para que la clave de caché no baile. */
export function uniqueTexts(texts: string[]): string[] {
  return Array.from(
    new Set(texts.map((t) => t.trim()).filter((t) => t.length > 0))
  ).sort();
}

export const translationsKey = (unique: string[]) => ["translations", unique];

/**
 * Traduce varios textos al español en paralelo.
 * Devuelve un mapa {original → traducción}; lo que falle queda fuera.
 *
 * Se exporta suelta —además del hook— para que el modo automático la use
 * compartiendo exactamente la misma caché.
 */
export async function fetchTranslations(
  unique: string[]
): Promise<Record<string, string>> {
  const results = await Promise.all(unique.map(translateOne));
  const map: Record<string, string> = {};
  unique.forEach((text, index) => {
    const value = results[index];
    // Una traducción idéntica al original no aporta nada
    if (value && value.toLowerCase() !== text.toLowerCase()) {
      map[text] = value;
    }
  });
  return map;
}

export function useTranslations(texts: string[]) {
  const unique = uniqueTexts(texts);

  return useQuery({
    queryKey: translationsKey(unique),
    enabled: unique.length > 0,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: false,
    queryFn: () => fetchTranslations(unique),
  });
}
