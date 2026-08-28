import { useQuery } from "@tanstack/react-query";

// ── Traducción al español ───────────────────────────────────
//
// Fuentes gratis, sin API key y con CORS abierto. Se probaron tres: MyMemory
// quedó fuera porque traduce mal ("acknowledge" → "bloque de aceptado"). Google
// gtx acierta y es la más rápida —y va por dos hosts, ver GOOGLE_HOSTS—; Lingva
// queda de respaldo.

const TIMEOUT_MS = 6000;

/**
 * Google, por dos puertas.
 *
 * Es la misma API y la misma respuesta: lo único que cambia es el host. Vale
 * tener las dos porque el bloqueo que aparece en la práctica es por host —una
 * extensión, una lista de filtros, una regla de red— y no por la petición. Con
 * `translate.googleapis.com` bloqueado, `clients5.google.com` responde igual;
 * sin esta segunda puerta la ficha se quedaba sin traducción y sin explicación.
 */
const GOOGLE_HOSTS = [
  "https://translate.googleapis.com",
  "https://clients5.google.com",
];

/**
 * Cuál de las dos contestó la última vez.
 *
 * Una vez que se sabe cuál anda, no se vuelve a pagar el intento perdido: en un
 * navegador donde la primera está bloqueada, cada palabra costaba un fetch
 * fallido antes de empezar.
 */
let preferredHost = 0;

async function fromGoogleHost(
  host: string,
  text: string
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${host}/translate_a/single` +
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

async function viaGoogle(text: string): Promise<string | null> {
  for (let attempt = 0; attempt < GOOGLE_HOSTS.length; attempt++) {
    const index = (preferredHost + attempt) % GOOGLE_HOSTS.length;
    const value = await fromGoogleHost(GOOGLE_HOSTS[index], text);
    if (value !== null) {
      preferredHost = index;
      return value;
    }
  }
  return null;
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
  let answered = 0;

  unique.forEach((text, index) => {
    const value = results[index];
    if (value !== null) answered += 1;
    // Una traducción idéntica al original no aporta nada
    if (value && value.toLowerCase() !== text.toLowerCase()) {
      map[text] = value;
    }
  });

  /**
   * Ni una sola respuesta de un lote entero no es "no hay traducción": es que
   * no se llegó al traductor —sin red, con un bloqueador de por medio o con
   * las dos fuentes caídas—. Distinguirlo importa porque la ficha mostraba un
   * renglón en blanco en los dos casos, y un blanco no se puede depurar.
   */
  if (unique.length > 0 && answered === 0) {
    throw new Error("No pude alcanzar el traductor");
  }

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
