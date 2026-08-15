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
