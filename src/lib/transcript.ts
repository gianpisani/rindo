// ── Transcripciones ─────────────────────────────────────────
//
// YouTube dejó de servir el endpoint de subtítulos sin un token de BotGuard,
// así que no se pueden bajar automáticamente. La transcripción se pega una vez
// por video (botón "Mostrar transcripción" en YouTube) y queda cacheada.
//
// El parser acepta los tres formatos que uno se encuentra en la práctica:
// el copiado de YouTube, SRT y VTT.

export interface Cue {
  /** Segundo en que arranca la línea. */
  t: number;
  text: string;
}

/** "1:02:05" | "12:34" | "00:00:15,000" | "00:00:15.000" → segundos */
function parseTimestamp(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  const parts = cleaned.split(":");
  if (parts.length < 2 || parts.length > 3) return null;

  const numbers = parts.map((p) => Number(p));
  if (numbers.some((n) => !Number.isFinite(n) || n < 0)) return null;

  const [a, b, c] = numbers;
  const seconds = parts.length === 3 ? a * 3600 + b * 60 + c : a * 60 + b;
  return Math.floor(seconds);
}

const TIMESTAMP = String.raw`\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?`;

/** Línea que es solo un timestamp: el formato que copia YouTube. */
const ONLY_TIMESTAMP = new RegExp(`^(${TIMESTAMP})$`);
/** Timestamp seguido de texto en la misma línea. */
const TIMESTAMP_PREFIX = new RegExp(`^(${TIMESTAMP})\\s+(.*)$`);
/** Rango de SRT/VTT: 00:00:15,000 --> 00:00:18,000 */
const RANGE = new RegExp(`^(${TIMESTAMP})\\s*-->\\s*(${TIMESTAMP})`);

function cleanText(text: string): string {
  return text
    // Etiquetas de VTT y de hablante
    .replace(/<[^>]*>/g, "")
    .replace(/\{\\[^}]*\}/g, "")
    // Ruidos de subtítulo automático
    .replace(/\[(Music|Applause|Laughter|Música|Aplausos)\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convierte texto pegado en líneas con tiempo.
 * Devuelve [] si no reconoce ningún timestamp.
 */
export function parseTranscript(raw: string): Cue[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const cues: Cue[] = [];

  let pendingTime: number | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (pendingTime === null) {
      buffer = [];
      return;
    }
    const text = cleanText(buffer.join(" "));
    if (text) cues.push({ t: pendingTime, text });
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Una línea en blanco cierra el bloque actual (SRT y VTT)
    if (!trimmed) {
      flush();
      pendingTime = null;
      continue;
    }

    // Cabecera de VTT y numeración de SRT: no aportan
    if (trimmed === "WEBVTT" || /^\d+$/.test(trimmed)) continue;

    const range = trimmed.match(RANGE);
    if (range) {
      flush();
      pendingTime = parseTimestamp(range[1]);
      continue;
    }

    const only = trimmed.match(ONLY_TIMESTAMP);
    if (only) {
      flush();
      pendingTime = parseTimestamp(only[1]);
      continue;
    }

    const prefixed = trimmed.match(TIMESTAMP_PREFIX);
    if (prefixed) {
      flush();
      pendingTime = parseTimestamp(prefixed[1]);
      buffer.push(prefixed[2]);
      continue;
    }

    buffer.push(trimmed);
  }

  flush();

  // Ordena y funde líneas que caen en el mismo segundo
  cues.sort((a, b) => a.t - b.t);

  const merged: Cue[] = [];
  for (const cue of cues) {
    const last = merged[merged.length - 1];
    if (last && last.t === cue.t) {
      last.text = `${last.text} ${cue.text}`.trim();
    } else {
      merged.push(cue);
    }
  }

  return merged;
}

/** Índice de la línea que corresponde al segundo dado, o -1. */
export function activeCueIndex(cues: Cue[], seconds: number): number {
  if (cues.length === 0) return -1;

  let low = 0;
  let high = cues.length - 1;
  let found = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid].t <= seconds) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return found;
}

/**
 * Parte el texto en palabras y separadores, conservando todo.
 * Permite renderizar cada palabra como un elemento clickeable.
 */
export function splitWords(text: string): { value: string; isWord: boolean }[] {
  return text
    .split(/([A-Za-zÀ-ÿ0-9]+(?:['’][A-Za-z]+)?)/g)
    .filter((part) => part !== "")
    .map((part) => ({
      value: part,
      isWord: /[A-Za-zÀ-ÿ0-9]/.test(part),
    }));
}

/** Deja una palabra lista para buscar en el diccionario. */
export function normalizeLookup(term: string): string {
  return term
    .trim()
    .toLowerCase()
    .replace(/^[^\w'’-]+|[^\w'’-]+$/g, "")
    .replace(/\s+/g, " ");
}

/**
 * El texto entre dos palabras de una línea, ambas incluidas.
 *
 * Se devuelve tal cual está escrito —con sus comas y sus apóstrofes— porque
 * eso es lo que se manda a traducir: "no me digas" no es lo mismo que
 * "no me digas," pegado a la frase de al lado.
 *
 * `to` puede ser Infinity: la frase sigue en la línea de abajo.
 */
export function sliceWords(text: string, from: number, to: number): string {
  const parts = splitWords(text);

  let ord = -1;
  let start = -1;
  let end = -1;
  parts.forEach((part, index) => {
    if (!part.isWord) return;
    ord += 1;
    if (ord === from) start = index;
    if (ord === to) end = index;
  });

  if (start === -1) return "";
  if (end === -1) end = parts.length - 1;

  return parts
    .slice(start, end + 1)
    .map((part) => part.value)
    .join("")
    .trim();
}
