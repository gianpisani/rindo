// ── El corpus ───────────────────────────────────────────────
//
// La idea de fondo: dejar de medir cuánto estudiaste y medir tu inglés contra
// el inglés que efectivamente consumes.
//
// Rindo ya guarda la transcripción de cada video que ves. Eso es un corpus:
// miles de palabras del inglés real al que te expones. Cruzarlo con las
// palabras que te frenaron da métricas que no dependen de que declares nada.
//
// Dos piezas acá:
//   1. Lematización con diccionario: "companies" y "company" son la misma
//      palabra para efectos de contar.
//   2. Bandas de frecuencia: cada palabra del inglés tiene un puesto conocido
//      en el ranking de uso. El puesto de las palabras que te frenan es la
//      medida honesta de tu nivel, porque no la puedes inflar esforzándote
//      menos: si capturas poco, hay menos datos, no mejor nota.

/** Palabras del inglés en la lista, en orden de uso. rank 1 = la más usada. */
export const FREQUENCY_LIST_SIZE = 46_717;

/** Dónde vive la lista. Se baja una vez y queda cacheada. */
export const FREQUENCY_LIST_URL = "/data/en-freq-50k.txt";

// ── Bandas ──────────────────────────────────────────────────

export type BandKey = "core" | "common" | "mid" | "advanced" | "rare" | "off";

export interface Band {
  key: BandKey;
  label: string;
  /** Rango de puestos que cubre, para explicarlo sin jerga. */
  hint: string;
  /** Variable CSS con el color de la banda. */
  color: string;
  /** Último puesto que entra en la banda. */
  max: number;
}

/**
 * Cinco escalones más el "fuera de lista".
 *
 * Los cortes no son arbitrarios: las primeras mil palabras cubren cerca del
 * 85% de una conversación, las primeras tres mil te dejan seguir un podcast, y
 * de diez mil para arriba ya es vocabulario que un nativo tampoco usa a diario.
 */
export const BANDS: Band[] = [
  { key: "core", label: "Básicas", hint: "top 1.000", color: "var(--band-1)", max: 1_000 },
  { key: "common", label: "Frecuentes", hint: "1.000–3.000", color: "var(--band-2)", max: 3_000 },
  { key: "mid", label: "Intermedias", hint: "3.000–10.000", color: "var(--band-3)", max: 10_000 },
  { key: "advanced", label: "Avanzadas", hint: "10.000–25.000", color: "var(--band-4)", max: 25_000 },
  { key: "rare", label: "Raras", hint: "25.000+", color: "var(--band-5)", max: FREQUENCY_LIST_SIZE },
  { key: "off", label: "Fuera de lista", hint: "nombres propios o erratas", color: "var(--band-none)", max: Infinity },
];

export const BAND_BY_KEY = Object.fromEntries(
  BANDS.map((b) => [b.key, b])
) as Record<BandKey, Band>;

export function bandOf(rank: number | null): Band {
  if (rank === null) return BAND_BY_KEY.off;
  return BANDS.find((b) => rank <= b.max) ?? BAND_BY_KEY.off;
}

// ── Tokenización ────────────────────────────────────────────

/**
 * Palabras de un texto en inglés. Se conserva el apóstrofo porque "don't" y
 * "dont" no son lo mismo para la lista de frecuencias, y se descartan los
 * números: un año no dice nada de tu vocabulario.
 */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
}

/**
 * Sobre este puesto no se lematiza.
 *
 * Las primeras trescientas palabras del inglés son casi todas gramaticales
 * ("his", "was", "does", "this") y las reglas de sufijos las destrozan:
 * "his" → "hi", "does" → "doe". Además son justo las que a nadie le interesa
 * analizar, así que se dejan tal cual.
 */
const NO_LEMMA_RANK = 300;

/** Mínimo de letras que debe quedar en la raíz para creerle a la regla. */
const MIN_STEM = 3;

/**
 * Formas candidatas a lema, de la más probable a la menos.
 *
 * No hay tabla de irregulares: cada candidata se valida contra la lista de
 * frecuencias, así que una regla que produce basura simplemente no encuentra
 * su candidata y la palabra se queda como estaba.
 */
function lemmaCandidates(word: string): string[] {
  const out: string[] = [];
  const stem = (n: number) => word.slice(0, -n);
  const long = (s: string) => (s.length >= MIN_STEM ? s : null);
  const push = (s: string | null) => {
    if (s && s !== word && !out.includes(s)) out.push(s);
  };

  if (word.endsWith("ies")) push(long(stem(3) + "y"));
  if (word.endsWith("es")) {
    push(long(stem(2)));
    push(long(stem(1)));
  } else if (word.endsWith("s") && !word.endsWith("ss")) {
    push(long(stem(1)));
  }

  if (word.endsWith("ed")) {
    push(long(stem(2)));
    push(long(stem(1)));
    // "stopped" → "stop": consonante doblada antes del sufijo
    const base = stem(2);
    if (base.length > MIN_STEM && base.at(-1) === base.at(-2)) {
      push(long(base.slice(0, -1)));
    }
  }

  if (word.endsWith("ing")) {
    const base = stem(3);
    push(long(base));
    push(long(base + "e"));
    if (base.length > MIN_STEM && base.at(-1) === base.at(-2)) {
      push(long(base.slice(0, -1)));
    }
  }

  // Nada de -er ni -est. Ganaban poco ("faster" → "fast") y arruinaban mucho:
  // "cater" → "cat", "mother" → "moth", "cover" → "cove", "matter" → "matte".
  // Todas esas raíces existen en la lista, así que ninguna validación las
  // atrapa; la única defensa es no intentarlo.
  if (word.endsWith("ly")) push(long(stem(2)));

  return out;
}

/** Busca el puesto de una palabra en la lista. null = no está. */
export type RankLookup = (word: string) => number | null;

/**
 * Lleva una palabra a su forma de diccionario, si es que existe.
 * Sin la lista cargada devuelve la palabra tal cual: el conteo pierde
 * precisión pero nada se rompe.
 */
export function lemmatize(word: string, rank: RankLookup): string {
  const own = rank(word);
  if (own !== null && own <= NO_LEMMA_RANK) return word;

  // Se queda la candidata MÁS usada, no la primera que exista: las reglas de
  // sufijo producen basura que a veces también está en la lista ("making" da
  // "mak" antes que "make"), y esa basura siempre es rarísima. Exigir además
  // que sea más común que la palabra original descarta el resto.
  let best: string | null = null;
  let bestRank = own ?? Infinity;

  for (const candidate of lemmaCandidates(word)) {
    const candidateRank = rank(candidate);
    if (candidateRank !== null && candidateRank < bestRank) {
      best = candidate;
      bestRank = candidateRank;
    }
  }

  return best ?? word;
}

/**
 * El puesto que le corresponde a una palabra: el de su forma más fácil.
 *
 * "challenged" está en el puesto 7.956 y "challenge" en el 1.885. Quien sabe
 * "challenge" entiende "challenged", así que cobrar el puesto de la forma
 * conjugada exageraría tu nivel.
 */
export function effectiveRank(word: string, rank: RankLookup): number | null {
  const own = rank(word);
  const lemma = lemmatize(word, rank);
  const lemmaRank = lemma === word ? null : rank(lemma);
  if (own === null) return lemmaRank;
  if (lemmaRank === null) return own;
  return Math.min(own, lemmaRank);
}

// ── Qué guardaste: una palabra, una expresión o una frase ───

export type ItemKind = "word" | "phrase" | "sentence";

/** Hasta acá una captura sigue siendo una expresión y no una frase entera. */
export const MAX_PHRASE_WORDS = 4;

/**
 * El tipo se deduce del texto, no de la etiqueta que elegiste al capturar.
 *
 * En la práctica la etiqueta sale mal seguido —"given" quedó marcada como
 * frase y "threes" como expresión— porque se elige apurado en mitad del
 * video. El largo del texto nunca miente.
 */
export function kindOf(expression: string): ItemKind {
  const words = tokenize(expression).length;
  if (words <= 1) return "word";
  return words <= MAX_PHRASE_WORDS ? "phrase" : "sentence";
}

export const ITEM_KIND_CONFIG: Record<
  ItemKind,
  { label: string; plural: string }
> = {
  word: { label: "Palabra", plural: "Palabras" },
  phrase: { label: "Expresión", plural: "Expresiones" },
  sentence: { label: "Frase", plural: "Frases" },
};

/**
 * El puesto de una captura: el de la palabra más rara que la compone, que es
 * la que te frenó.
 *
 * Una frase entera **no tiene puesto** y devuelve null a propósito. En una
 * oración de treinta palabras siempre hay alguna rarísima, así que puntuarla
 * ensuciaría la banda: mediría el largo de lo que guardas, no tu inglés.
 */
export function expressionRank(expression: string, rank: RankLookup): number | null {
  const words = tokenize(expression);
  if (words.length === 0 || words.length > MAX_PHRASE_WORDS) return null;

  const ranks = words
    .map((w) => effectiveRank(w, rank))
    .filter((r): r is number => r !== null);
  return ranks.length === 0 ? null : Math.max(...ranks);
}

/** La palabra más rara de un texto largo, con su puesto. Para las frases. */
export function rarestWord(
  expression: string,
  rank: RankLookup
): { word: string; rank: number } | null {
  let worst: { word: string; rank: number } | null = null;
  for (const word of tokenize(expression)) {
    const wordRank = effectiveRank(word, rank);
    if (wordRank !== null && (!worst || wordRank > worst.rank)) {
      worst = { word, rank: wordRank };
    }
  }
  return worst;
}

// ── Estadística ─────────────────────────────────────────────

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** 5.712 → "5.7k". Los puestos se leen mejor redondos. */
export function formatRank(rank: number | null): string {
  if (rank === null) return "fuera de lista";
  if (rank < 1_000) return `#${rank}`;
  return `#${(rank / 1_000).toFixed(1)}k`;
}

// ── Distancia de edición, para cazar erratas ────────────────

/** ¿Difieren en exactamente una letra, en la misma posición? */
function onlyOneSubstitution(a: string, b: string): boolean {
  let diffs = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i] && (diffs += 1) > 1) return false;
  }
  return diffs === 1;
}

/**
 * Distancia de Levenshtein con corte temprano: solo interesa saber si dos
 * palabras están a un error de distancia, así que se abandona apenas se pasa.
 */
export function isOneEditAway(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a === b) return false;

  // Dos letras cambiadas de orden cuentan como un error: es la errata más
  // común al escribir rápido —"jewerly" por "jewelry"— y Levenshtein a secas
  // la cobra como dos.
  if (a.length === b.length) {
    for (let k = 0; k < a.length - 1; k += 1) {
      if (a[k] === b[k]) continue;
      const swapped = a.slice(0, k) + a[k + 1] + a[k] + a.slice(k + 2);
      return swapped === b || onlyOneSubstitution(a, b);
    }
  }

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;

    if (a.length === b.length) {
      i += 1;
      j += 1;
    } else if (a.length > b.length) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return edits + (a.length - i) + (b.length - j) <= 1;
}

// ── Dominio inferido ────────────────────────────────────────

export type InferredMastery = "stuck" | "exposed" | "settled" | "unknown";

export interface MasteryEvidence {
  level: InferredMastery;
  /** La frase que lo explica, en tus datos. */
  reason: string;
}

/** Veces que tiene que reaparecer sin frenarte para creerle a la evidencia. */
const EXPOSED_THRESHOLD = 6;
const SETTLED_THRESHOLD = 14;

/**
 * Qué dice el corpus sobre una palabra que capturaste.
 *
 * No reemplaza el dominio que marcas a mano: lo propone con la evidencia a la
 * vista. Es la diferencia entre una etiqueta que pusiste tú y un hecho.
 */
export function inferMastery(
  occurrences: number,
  stops: number
): MasteryEvidence {
  if (stops >= 3) {
    return {
      level: "stuck",
      reason: `Te frenó ${stops} veces: todavía no la tienes`,
    };
  }
  if (occurrences >= SETTLED_THRESHOLD && stops <= 1) {
    return {
      level: "settled",
      reason: `Aparece ${occurrences} veces en tu corpus y solo te frenó una`,
    };
  }
  if (occurrences >= EXPOSED_THRESHOLD && stops <= 1) {
    return {
      level: "exposed",
      reason: `Ya la oíste ${occurrences} veces sin volver a frenarte`,
    };
  }
  if (stops > 1) {
    return {
      level: "unknown",
      reason: `Te frenó ${stops} veces: sigue en observación`,
    };
  }
  return {
    level: "unknown",
    reason:
      occurrences <= 1
        ? "No ha vuelto a aparecer en tu corpus"
        : `Solo ${occurrences} apariciones: muy poco para saberlo`,
  };
}

export const INFERRED_MASTERY_CONFIG: Record<
  InferredMastery,
  { label: string; dot: string; text: string }
> = {
  stuck: { label: "Se te atraviesa", dot: "bg-amber-500", text: "text-amber-500" },
  exposed: { label: "Expuesta", dot: "bg-violet-500", text: "text-violet-500" },
  settled: { label: "Asentada", dot: "bg-emerald-500", text: "text-emerald-500" },
  unknown: { label: "Sin evidencia", dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
};

// ── Deuda ───────────────────────────────────────────────────

/**
 * Cuánto te cuesta no saber una palabra.
 *
 * Manda cuántas veces aparece en el inglés que tú consumes; empata por su
 * frecuencia general, que es la mejor apuesta sobre cuánto va a reaparecer en
 * lo que veas mañana. Ordenar el diccionario por esto es lo que lo convierte
 * en una lista de prioridades en vez de un registro cronológico.
 */
export function debtScore(occurrences: number, rank: number | null): number {
  const generality = rank === null ? 0 : (FREQUENCY_LIST_SIZE - rank) / FREQUENCY_LIST_SIZE;
  return occurrences * 10 + generality * 5;
}
