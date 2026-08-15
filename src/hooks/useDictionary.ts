import { useQuery } from "@tanstack/react-query";
import { normalizeLookup } from "@/lib/transcript";

export interface DictionarySense {
  partOfSpeech: string | null;
  definition: string;
  example: string | null;
}

export interface DictionaryEntry {
  term: string;
  phonetic: string | null;
  audioUrl: string | null;
  senses: DictionarySense[];
  source: "dictionaryapi" | "wiktionary";
}

const TIMEOUT_MS = 7000;

async function getJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ── dictionaryapi.dev: fonética y audio, pero se cae seguido ─

interface FreeDictPhonetic {
  text?: string;
  audio?: string;
}
interface FreeDictDefinition {
  definition?: string;
  example?: string;
}
interface FreeDictMeaning {
  partOfSpeech?: string;
  definitions?: FreeDictDefinition[];
}
interface FreeDictEntry {
  word?: string;
  phonetic?: string;
  phonetics?: FreeDictPhonetic[];
  meanings?: FreeDictMeaning[];
}

async function fromDictionaryApi(term: string): Promise<DictionaryEntry | null> {
  const data = await getJson(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`
  );
  if (!Array.isArray(data) || data.length === 0) return null;

  const entries = data as FreeDictEntry[];
  const senses: DictionarySense[] = [];

  for (const entry of entries) {
    for (const meaning of entry.meanings ?? []) {
      for (const def of meaning.definitions ?? []) {
        if (!def.definition) continue;
        senses.push({
          partOfSpeech: meaning.partOfSpeech ?? null,
          definition: def.definition,
          example: def.example ?? null,
        });
        if (senses.length >= 4) break;
      }
      if (senses.length >= 4) break;
    }
    if (senses.length >= 4) break;
  }

  if (senses.length === 0) return null;

  const allPhonetics = entries.flatMap((e) => e.phonetics ?? []);

  return {
    term,
    phonetic:
      entries.find((e) => e.phonetic)?.phonetic ??
      allPhonetics.find((p) => p.text)?.text ??
      null,
    audioUrl: allPhonetics.find((p) => p.audio)?.audio ?? null,
    senses,
    source: "dictionaryapi",
  };
}

// ── Wiktionary: más lento de leer pero tiene phrasal verbs ───

interface WiktionaryDefinition {
  definition?: string;
  examples?: string[];
}
interface WiktionarySection {
  partOfSpeech?: string;
  definitions?: WiktionaryDefinition[];
}

async function fromWiktionary(term: string): Promise<DictionaryEntry | null> {
  const slug = encodeURIComponent(term.replace(/\s+/g, "_"));
  const data = await getJson(
    `https://en.wiktionary.org/api/rest_v1/page/definition/${slug}`
  );
  if (!data || typeof data !== "object") return null;

  const sections = (data as Record<string, WiktionarySection[]>).en;
  if (!Array.isArray(sections)) return null;

  const senses: DictionarySense[] = [];
  for (const section of sections) {
    for (const def of section.definitions ?? []) {
      const text = stripHtml(def.definition ?? "");
      // Wiktionary marca así los sentidos literales, que no aportan nada
      if (!text || /^Used other than figuratively/i.test(text)) continue;
      senses.push({
        partOfSpeech: section.partOfSpeech ?? null,
        definition: text,
        example: def.examples?.[0] ? stripHtml(def.examples[0]) : null,
      });
      if (senses.length >= 4) break;
    }
    if (senses.length >= 4) break;
  }

  if (senses.length === 0) return null;

  return { term, phonetic: null, audioUrl: null, senses, source: "wiktionary" };
}

// ── Wiktionary en crudo: la fonética que las otras dos no traen ─

export interface Pronunciation {
  phonetic: string | null;
  audioUrl: string | null;
  /** Armada juntando la de cada palabra, porque la expresión no tiene la suya. */
  approximate?: boolean;
}

/**
 * Recorta la sección inglesa. El mismo lema suele existir en varios idiomas
 * en la misma página, y la fonética del francés no sirve de nada acá.
 */
function englishSection(wikitext: string): string {
  const start = wikitext.search(/^==\s*English\s*==/m);
  if (start === -1) return wikitext;
  const rest = wikitext.slice(start + 1);
  const end = rest.search(/^==[^=]/m);
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * La plantilla viene en varias formas —`{{IPA|en|/x/}}`, `{{IPA|/x/|lang=en}}`,
 * con varios acentos seguidos— así que en vez de calzar una forma exacta se
 * busca el primer parámetro que parezca una transcripción: entre / / o [ ].
 */
function extractIpa(wikitext: string): string | null {
  for (const match of wikitext.matchAll(/\{\{IPA\|([^}]*)\}\}/g)) {
    const found = match[1]
      .split("|")
      .map((part) => part.trim())
      .find((part) => /^[/[].+[/\]]$/.test(part));
    if (found) return found;
  }
  return null;
}

/** Se prefiere el audio estadounidense, y el mp3 al ogg: Safari no lee ogg. */
function extractAudioFile(wikitext: string): string | null {
  const files: string[] = [];
  for (const match of wikitext.matchAll(/\{\{audio\|([^}]*)\}\}/gi)) {
    for (const part of match[1].split("|")) {
      const value = part.trim();
      if (/\.(ogg|oga|mp3|wav)$/i.test(value)) files.push(value);
    }
  }
  if (files.length === 0) return null;

  const score = (file: string) =>
    (/\.mp3$/i.test(file) ? 2 : 0) + (/en[-_]us/i.test(file) ? 1 : 0);

  return files.sort((a, b) => score(b) - score(a))[0];
}

/**
 * Fonética y audio sacados del wikitexto de Wiktionary.
 *
 * Es la única fuente de las tres que cubre expresiones de varias palabras, que
 * es justo donde dictionaryapi.dev no tiene nada.
 */
async function fetchWikitext(normalized: string): Promise<string | null> {
  const slug = encodeURIComponent(normalized.replace(/\s+/g, "_"));
  const data = await getJson(
    "https://en.wiktionary.org/w/api.php?action=parse&prop=wikitext" +
      `&formatversion=2&format=json&origin=*&page=${slug}`
  );

  const wikitext = (data as { parse?: { wikitext?: unknown } } | null)?.parse
    ?.wikitext;
  return typeof wikitext === "string" ? englishSection(wikitext) : null;
}

/** Máximo de palabras que se buscan sueltas para armar la fonética. */
const MAX_COMPOSED_WORDS = 4;

/**
 * Junta la fonética de cada palabra: `/kʌm/` + `/əˈkɹɒs/` → `/kʌm əˈkɹɒs/`.
 *
 * Es una aproximación —al hablar, el acento de la expresión no es la suma de
 * los acentos sueltos— pero para leer una expresión que nunca oíste es
 * infinitamente mejor que no mostrar nada. Se marca como tal.
 */
async function composePhonetic(words: string[]): Promise<string | null> {
  const texts = await Promise.all(
    words.map(async (word) => {
      const wikitext = await fetchWikitext(word);
      return wikitext ? extractIpa(wikitext) : null;
    })
  );

  // Con una sola palabra sin fonética la transcripción ya sería engañosa.
  if (texts.some((text) => !text)) return null;

  const inner = texts.map((text) => text!.replace(/^[/[]|[/\]]$/g, ""));
  return `/${inner.join(" ")}/`;
}

/**
 * Fonética y audio sacados del wikitexto de Wiktionary.
 *
 * Es la única fuente de las tres que cubre expresiones de varias palabras, que
 * es justo donde dictionaryapi.dev no tiene nada.
 */
export async function fetchPronunciation(
  normalized: string
): Promise<Pronunciation | null> {
  const english = await fetchWikitext(normalized);

  const file = english ? extractAudioFile(english) : null;
  const audioUrl = file
    ? // Special:FilePath redirige al archivo real, así que no hace falta una
      // segunda vuelta a la API de Commons para resolver la ruta con hash.
      "https://commons.wikimedia.org/wiki/Special:FilePath/" +
      encodeURIComponent(file.replace(/\s+/g, "_"))
    : null;

  const phonetic = english ? extractIpa(english) : null;
  if (phonetic) return { phonetic, audioUrl };

  // Las expresiones casi nunca tienen fonética propia; se arma con la de sus
  // palabras antes de darse por vencido.
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > MAX_COMPOSED_WORDS) {
    return english ? { phonetic: null, audioUrl } : null;
  }

  const composed = await composePhonetic(words);
  return { phonetic: composed, audioUrl, approximate: !!composed };
}

export const pronunciationKey = (normalized: string) => [
  "pronunciation",
  normalized,
];

/**
 * Completa lo que le falte a la entrada principal. Va en su propia consulta a
 * propósito: la definición se ve al tiro y la fonética entra sola después, en
 * vez de hacer esperar a las dos por la más lenta.
 */
export function usePronunciation(term: string | null, enabled: boolean) {
  const normalized = term ? normalizeLookup(term) : "";

  return useQuery({
    queryKey: pronunciationKey(normalized),
    enabled: enabled && normalized.length > 1,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: false,
    queryFn: () => fetchPronunciation(normalized),
  });
}

export const dictionaryKey = (normalized: string) => ["dictionary", normalized];

/**
 * Busca una palabra o expresión.
 *
 * Prueba dictionaryapi.dev primero (trae fonética y audio) y cae a Wiktionary,
 * que es más estable y sí tiene phrasal verbs y modismos. Ambos son gratis,
 * sin API key y con CORS abierto.
 *
 * Se exporta suelta —además del hook— para que el modo automático la use
 * compartiendo exactamente la misma caché.
 */
export async function fetchDictionaryEntry(
  normalized: string
): Promise<DictionaryEntry | null> {
  const [primary, fallback] = await Promise.all([
    fromDictionaryApi(normalized),
    fromWiktionary(normalized),
  ]);

  if (!primary) return fallback;
  if (!fallback) return primary;

  // Si el principal trajo pocas acepciones, préstale las del respaldo.
  return {
    ...primary,
    senses: primary.senses.length >= 2 ? primary.senses : fallback.senses,
  };
}

export function useDictionary(term: string | null) {
  const normalized = term ? normalizeLookup(term) : "";
  const wordCount = normalized ? normalized.split(/\s+/).length : 0;
  const enabled = normalized.length > 1 && wordCount <= 5;

  return useQuery({
    queryKey: dictionaryKey(normalized),
    enabled,
    // Las definiciones no cambian: vale la pena guardarlas toda la sesión.
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: false,
    queryFn: () => fetchDictionaryEntry(normalized),
  });
}
