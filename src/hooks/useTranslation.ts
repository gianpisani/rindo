import { useQuery } from "@tanstack/react-query";

// ── Traducción al español ───────────────────────────────────
//
// Google, gratis y sin API key. La puerta importa: `client=gtx` —la que se
// usaba antes— empezó a contestar 429 a todo el mundo y encima no manda
// cabecera CORS, así que en producción cada ficha quedaba muda. `dict-chrome-ex`
// —la que usa la extensión de traducción de Chrome— sí responde, manda
// `access-control-allow-origin: *` y, sobre todo, acepta varios textos en una
// sola petición. MyMemory quedó fuera hace rato porque traduce mal
// ("acknowledge" → "bloque de aceptado") y Lingva está caído.

const TIMEOUT_MS = 6000;

/**
 * La misma API, por dos puertas.
 *
 * Lo único que cambia es el host: el bloqueo que aparece en la práctica es por
 * host —una extensión, una lista de filtros, una regla de red— y no por la
 * petición. Con una bloqueada, la otra responde igual.
 */
const HOSTS = ["https://clients5.google.com", "https://translate.googleapis.com"];

const PATH = "/translate_a/t?client=dict-chrome-ex&sl=en&tl=es";

/**
 * Cuál de las dos contestó la última vez.
 *
 * Una vez que se sabe cuál anda, no se vuelve a pagar el intento perdido: en un
 * navegador donde la primera está bloqueada, cada lote costaba un fetch fallido
 * antes de empezar.
 */
let preferredHost = 0;

/**
 * Lo ya traducido en esta sesión.
 *
 * La caché de react-query es por lote: la misma palabra, pedida junto a otra
 * definición, era un viaje nuevo. Con esto, repetir una palabra es instantáneo
 * y el lote solo pregunta por lo que no sabe.
 */
const memo = new Map<string, string>();
const MEMO_LIMIT = 2000;

function remember(text: string, translation: string) {
  if (memo.size >= MEMO_LIMIT) {
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(text, translation);
}

/**
 * Cuánto entra en una petición.
 *
 * Los textos viajan en la URL, así que el límite real es su largo; el tope de
 * cantidad es solo para que un lote de palabras sueltas no se haga eterno.
 */
const MAX_QUERY_CHARS = 1500;
const MAX_PER_REQUEST = 20;

function intoRequests(texts: string[]): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  let length = 0;

  for (const text of texts) {
    const cost = encodeURIComponent(text).length + 3; // "&q="
    if (current.length > 0 && (length + cost > MAX_QUERY_CHARS || current.length >= MAX_PER_REQUEST)) {
      groups.push(current);
      current = [];
      length = 0;
    }
    current.push(text);
    length += cost;
  }
  if (current.length > 0) groups.push(current);

  return groups;
}

/**
 * Un lote contra un host. Devuelve las traducciones en el mismo orden, o null
 * si el host no sirvió —para poder probar la otra puerta.
 */
async function fromHost(host: string, texts: string[]): Promise<string[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const query = texts.map((t) => `&q=${encodeURIComponent(t)}`).join("");
    const res = await fetch(`${host}${PATH}${query}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length !== texts.length) return null;

    // Con `sl=en` cada elemento es un string; si alguna vez viniera con el
    // idioma detectado, llega como [traducción, idioma].
    return data.map((value) => {
      if (typeof value === "string") return value.trim();
      if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0].trim();
      }
      return "";
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function translateBatch(texts: string[]): Promise<(string | null)[]> {
  for (let attempt = 0; attempt < HOSTS.length; attempt++) {
    const index = (preferredHost + attempt) % HOSTS.length;
    const values = await fromHost(HOSTS[index], texts);
    if (values) {
      preferredHost = index;
      return values.map((value) => value || null);
    }
  }
  return texts.map(() => null);
}

/** Sin duplicados y en orden estable, para que la clave de caché no baile. */
export function uniqueTexts(texts: string[]): string[] {
  return Array.from(
    new Set(texts.map((t) => t.trim()).filter((t) => t.length > 0))
  ).sort();
}

export const translationsKey = (unique: string[]) => ["translations", unique];

/**
 * Traduce varios textos al español de una sola vez.
 * Devuelve un mapa {original → traducción}; lo que falle queda fuera.
 *
 * Se exporta suelta —además del hook— para que el modo automático la use
 * compartiendo exactamente la misma caché.
 */
export async function fetchTranslations(
  unique: string[]
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  let answered = 0;

  const pending: string[] = [];
  for (const text of unique) {
    const known = memo.get(text);
    if (known === undefined) {
      pending.push(text);
      continue;
    }
    answered += 1;
    if (known.toLowerCase() !== text.toLowerCase()) map[text] = known;
  }

  const groups = intoRequests(pending);
  const results = await Promise.all(groups.map(translateBatch));

  groups.forEach((group, groupIndex) => {
    group.forEach((text, index) => {
      const value = results[groupIndex][index];
      if (value === null) return;
      answered += 1;
      remember(text, value);
      // Una traducción idéntica al original no aporta nada
      if (value.toLowerCase() !== text.toLowerCase()) map[text] = value;
    });
  });

  /**
   * Ni una sola respuesta de un lote entero no es "no hay traducción": es que
   * no se llegó al traductor —sin red, con un bloqueador de por medio o con
   * las dos puertas caídas—. Distinguirlo importa porque la ficha mostraba un
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
