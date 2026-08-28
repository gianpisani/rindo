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
export function activeCueIndex(
  cues: readonly { t: number }[],
  seconds: number
): number {
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

// ── De líneas de tiempo a bloques de lectura ────────────────
//
// Los cues no son frases: son tajadas de reloj. YouTube corta cada dos
// segundos, sin mirar dónde. El corpus lo dice sin ambigüedad —en una de las
// transcripciones el 79% de las líneas termina a media frase, y en otra el
// 100%, con un solo punto en todo el video.
//
// Juntarlos en bloques legibles NO se hace detectando frases: si dependiera de
// la puntuación, dependería justo de lo que no está. Se hace eligiendo dónde
// cortar, que es otro problema y sí tiene solución general.
//
// El planteo es el de partir un párrafo en renglones, el mismo de TeX: cada
// corte tiene un costo, cada bloque tiene un costo por alejarse del largo
// cómodo, y se busca el reparto de costo total mínimo con programación
// dinámica. Si hay puntuación, cortar ahí sale gratis y los bloques salen
// frases; si no hay, esos cortes simplemente nunca aparecen y mandan la pausa
// del hablante y el largo. Es el mismo camino de código para las dos: no hay
// modo "con puntuación" y modo "sin", que es lo que se rompería con la
// transcripción número doce.
//
// Dos límites que lo hacen seguro en cualquier entrada:
//
//   1. Solo junta. Nunca parte un cue ni reescribe una palabra, así que el
//      texto que sale es exactamente el que entró y el tiempo de cada trozo
//      sigue siendo el suyo. Una transcripción que ya viene en bloques densos
//      no se toca: el algoritmo no tiene nada que ganar y no hace nada.
//   2. Nada se junta cruzando un silencio. Un corte de escena o una pausa
//      larga es un límite duro, no una preferencia.

/** Un trozo original dentro de un bloque: conserva su segundo. */
export interface BlockSegment {
  t: number;
  text: string;
  /** Índice de su primera palabra dentro del bloque. */
  firstWord: number;
}

/** Un bloque de lectura: varias líneas de tiempo cosidas en un texto. */
export interface Block {
  t: number;
  text: string;
  segments: BlockSegment[];
}

export interface GroupOptions {
  /**
   * Largo cómodo de un bloque, en caracteres.
   *
   * Sale del render —cuántos caracteres entran en un renglón de la pista al
   * ancho que tenga— y no del contenido. Esa es la diferencia entre un número
   * calibrado para un video y uno que vale para todos.
   */
  target?: number;
  /** Largo máximo. Nada se junta si el resultado pasa de acá. */
  max?: number;
}

/** Termina una idea: el corte más barato que existe. */
const ENDS_HARD = /[.!?…]["'”’)\]»]*$/;
/** Termina una parte de una idea. */
const ENDS_SOFT = /[,;:—–-]$/;
/** Empieza como empieza una oración. Solo sirve de desempate. */
const STARTS_UPPER = /^\p{Lu}/u;

/** Cuánto cuesta cortar después de cada tipo de línea. */
const CUT_COST = {
  hard: 0,
  pause: 0.15,
  soft: 0.45,
  upper: 0.7,
  none: 1,
} as const;

/** Silencio, en segundos, que ya cuenta como final de idea. */
const PAUSE_SECONDS = 1;
/** Silencio a partir del cual no se junta nada, pase lo que pase. */
const BARRIER_SECONDS = 4;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Junta los cues en bloques de lectura.
 *
 * Determinista y sin estado: la misma entrada da siempre la misma salida, no
 * mira el reloj ni la red, y no hay nada que revisar a mano.
 */
export function groupCues(cues: Cue[], options: GroupOptions = {}): Block[] {
  const target = options.target ?? 110;
  const max = options.max ?? 190;
  const n = cues.length;
  if (n === 0) return [];

  const words = cues.map(
    (cue) => splitWords(cue.text).filter((part) => part.isWord).length
  );
  const chars = cues.map((cue) => cue.text.length);

  /** Cuánto dura cada línea. La última hereda la mediana: no hay con qué. */
  const spans = cues.map((cue, i) =>
    i + 1 < n ? Math.max(0, cues[i + 1].t - cue.t) : 0
  );
  const typical = median(spans.slice(0, -1).filter((s) => s > 0));
  if (n > 1) spans[n - 1] = typical;

  /**
   * El ritmo del hablante medido en ESTA transcripción. Un locutor lento y uno
   * rápido no comparten umbral, así que el umbral no puede ser una constante.
   */
  const rate = median(
    spans
      .map((span, i) => (words[i] >= 3 && span > 0 ? span / words[i] : 0))
      .filter((r) => r > 0)
  );

  /** Silencio estimado al final de una línea: lo que duró de más. */
  const silence = spans.map((span, i) => span - words[i] * rate);

  const cutCost = (i: number): number => {
    const text = cues[i].text;
    if (ENDS_HARD.test(text)) return CUT_COST.hard;
    if (silence[i] >= PAUSE_SECONDS) return CUT_COST.pause;
    if (ENDS_SOFT.test(text)) return CUT_COST.soft;
    if (i + 1 < n && STARTS_UPPER.test(cues[i + 1].text)) return CUT_COST.upper;
    return CUT_COST.none;
  };

  // ── El reparto más barato, de atrás para adelante ──────────

  const best = new Float64Array(n + 1);
  const nextStart = new Int32Array(n + 1);

  for (let i = n - 1; i >= 0; i--) {
    best[i] = Infinity;
    let length = 0;

    for (let j = i; j < n; j++) {
      length += chars[j] + (j > i ? 1 : 0);
      // Un cue solo siempre es una opción válida, aunque él mismo pase del
      // máximo: partirlo no está permitido, y quedarse sin salida tampoco.
      if (j > i && length > max) break;

      const fit = ((length - target) / target) ** 2;
      const cost = fit + (j === n - 1 ? 0 : cutCost(j)) + best[j + 1];
      if (cost < best[i]) {
        best[i] = cost;
        nextStart[i] = j + 1;
      }

      if (silence[j] >= BARRIER_SECONDS) break;
    }
  }

  // ── El reparto elegido, ya como bloques ───────────────────

  const blocks: Block[] = [];
  for (let i = 0; i < n; i = nextStart[i]) {
    const end = nextStart[i];
    const segments: BlockSegment[] = [];
    let firstWord = 0;

    for (let j = i; j < end; j++) {
      segments.push({ t: cues[j].t, text: cues[j].text, firstWord });
      firstWord += words[j];
    }

    blocks.push({
      t: cues[i].t,
      text: segments.map((segment) => segment.text).join(" "),
      segments,
    });
  }

  return blocks;
}


/**
 * El segundo estimado de cada palabra del bloque.
 *
 * La transcripción trae tiempo por línea, no por palabra: entre un tiempo y el
 * siguiente hay siete palabras y ningún dato de cuándo cae cada una. Se reparte
 * el tramo entre ellas a prorrata de su largo, que es lo que hace cualquier
 * karaoke sin timing fino.
 *
 * Es una estimación y hay que tratarla como tal: sirve para que un resaltado
 * suave barra la frase al ritmo en que se dice, no para calzar una caja dura
 * sobre una palabra —media palabra de error no se ve en lo primero y salta a la
 * vista en lo segundo.
 */
export function wordTimes(block: Block, endSeconds: number): number[] {
  const times: number[] = [];

  block.segments.forEach((segment, index) => {
    const next = block.segments[index + 1];
    const until = Math.max(segment.t, next ? next.t : endSeconds);
    const span = until - segment.t;

    const words = splitWords(segment.text).filter((part) => part.isWord);
    // El espacio cuenta: una palabra larga se dice en más tiempo que una corta.
    const weights = words.map((word) => word.value.length + 1);
    const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;

    let sofar = 0;
    for (const weight of weights) {
      times.push(segment.t + (span * sofar) / total);
      sofar += weight;
    }
  });

  return times;
}

/** El trozo original al que pertenece una palabra del bloque. */
export function segmentAtWord(block: Block, word: number): BlockSegment {
  let found = block.segments[0];
  for (const segment of block.segments) {
    if (segment.firstWord > word) break;
    found = segment;
  }
  return found;
}
