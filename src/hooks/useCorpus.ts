import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Cue } from "@/lib/transcript";
import {
  bandOf,
  effectiveRank,
  expressionRank,
  isOneEditAway,
  lemmatize,
  tokenize,
  type Band,
  type BandKey,
  type RankLookup,
} from "@/lib/corpus";
import { useFrequencyList } from "./useFrequencyList";

/** Un video del corpus, ya masticado. */
export interface CorpusVideo {
  externalId: string;
  title: string | null;
  /** Palabras dichas en total. */
  tokens: number;
  /** Palabras distintas, ya lematizadas. */
  distinct: number;
  /** Cuántas palabras dichas caen en cada banda de frecuencia. */
  bandTokens: Record<BandKey, number>;
  /** La banda más rara que aporta al menos un 1% del video. */
  hardestBand: Band;
  /** Cuántas de tus capturas aparecen acá. */
  stops: number;
}

export interface Corpus {
  isLoading: boolean;
  /** Sin lista de frecuencias no hay bandas ni lemas: la UI se muestra sobria. */
  isReady: boolean;
  rank: RankLookup;

  videoCount: number;
  totalTokens: number;
  distinctLemmas: number;
  videos: CorpusVideo[];
  /** Palabras dichas por banda, sumando todos los videos. */
  bandTokens: Record<BandKey, number>;

  /** Veces que una expresión aparece en todo lo que has visto. */
  occurrences: (expression: string) => number;
  /** En qué videos aparece. */
  videosWith: (expression: string) => CorpusVideo[];
  /** Puesto en el ranking de uso, para una palabra o una expresión. */
  rankOf: (expression: string) => number | null;
  /** Si no existe en inglés, la palabra real más parecida. */
  suggestSpelling: (expression: string) => string | null;
  /** Frases de tus propios videos donde se dice, con el minuto exacto. */
  examples: (expression: string, limit?: number) => CorpusExample[];
}

interface TranscriptRow {
  external_id: string;
  cues: Cue[];
}

/** Una frase real de tus videos donde se dice la expresión. */
export interface CorpusExample {
  externalId: string;
  title: string | null;
  seconds: number;
  text: string;
}

const emptyBands = (): Record<BandKey, number> => ({
  core: 0,
  common: 0,
  mid: 0,
  advanced: 0,
  rare: 0,
  off: 0,
});

/** Todas las transcripciones guardadas, con su texto. */
function useTranscriptCorpus() {
  return useQuery({
    queryKey: ["learning-corpus-transcripts"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_transcripts")
        .select("external_id, cues");
      if (error) throw error;
      return ((data ?? []) as unknown as TranscriptRow[]).map((row) => ({
        external_id: row.external_id,
        cues: row.cues ?? [],
        text: (row.cues ?? []).map((cue) => cue.text).join(" ").toLowerCase(),
      }));
    },
  });
}

/**
 * El corpus: todo el inglés que has escuchado, indexado.
 *
 * Se arma entero en memoria porque es chico —diez videos son 22 mil palabras—
 * y porque tenerlo así permite responder al tiro "¿cuántas veces has oído
 * esta palabra?", que es la pregunta que vuelve útil al diccionario.
 *
 * @param titles  Título de cada video, si se conoce, para poder nombrarlos.
 * @param stopped Las expresiones que capturaste, para marcar dónde te frenaste.
 */
export function useCorpus(
  titles: Map<string, string | null>,
  stopped: string[]
): Corpus {
  const { frequency, isReady, isLoading: freqLoading } = useFrequencyList();
  const { data: transcripts = [], isLoading: transcriptsLoading } =
    useTranscriptCorpus();

  const rank = frequency.rank;

  const index = useMemo(() => {
    // lema → { veces dicho, en qué videos }
    const words = new Map<string, { count: number; videos: Set<string> }>();
    const videos: CorpusVideo[] = [];
    const texts = new Map<string, string>();
    const cuesById = new Map<string, Cue[]>();
    const totals = emptyBands();

    for (const transcript of transcripts) {
      texts.set(transcript.external_id, transcript.text);
      cuesById.set(transcript.external_id, transcript.cues);

      const tokens = tokenize(transcript.text);
      const bandTokens = emptyBands();
      const seen = new Set<string>();

      for (const token of tokens) {
        const lemma = isReady ? lemmatize(token, rank) : token;
        seen.add(lemma);

        const entry = words.get(lemma) ?? { count: 0, videos: new Set<string>() };
        entry.count += 1;
        entry.videos.add(transcript.external_id);
        words.set(lemma, entry);

        const key = bandOf(isReady ? effectiveRank(lemma, rank) : null).key;
        bandTokens[key] += 1;
        totals[key] += 1;
      }

      // La banda más rara que no sea anecdótica: una sola palabra rarísima no
      // define la dificultad de un video de cuarenta minutos.
      const floor = Math.max(3, tokens.length * 0.01);
      const hardest =
        [...Object.entries(bandTokens)]
          .filter(([key, count]) => key !== "off" && count >= floor)
          .map(([key]) => key as BandKey)
          .pop() ?? "core";

      videos.push({
        externalId: transcript.external_id,
        title: titles.get(transcript.external_id) ?? null,
        tokens: tokens.length,
        distinct: seen.size,
        bandTokens,
        hardestBand: bandOf(
          hardest === "core" ? 1 : hardest === "common" ? 2_000 :
          hardest === "mid" ? 5_000 : hardest === "advanced" ? 15_000 : 30_000
        ),
        stops: 0,
      });
    }

    videos.sort((a, b) => b.tokens - a.tokens);
    return { words, videos, texts, cuesById, totals };
  }, [transcripts, isReady, rank, titles]);

  return useMemo(() => {
    const { words, videos, texts, cuesById, totals } = index;

    /**
     * Una palabra suelta se cuenta por su lema; una expresión de varias
     * palabras se busca literal en el texto, porque su lema no existe.
     */
    const countIn = (text: string, expression: string): number => {
      const parts = tokenize(expression);
      if (parts.length === 0) return 0;
      if (parts.length === 1) {
        const lemma = isReady ? lemmatize(parts[0], rank) : parts[0];
        return tokenize(text).filter(
          (token) => (isReady ? lemmatize(token, rank) : token) === lemma
        ).length;
      }
      const needle = parts.join(" ");
      return text.split(needle).length - 1;
    };

    const occurrences = (expression: string): number => {
      const parts = tokenize(expression);
      if (parts.length === 1) {
        const lemma = isReady ? lemmatize(parts[0], rank) : parts[0];
        return words.get(lemma)?.count ?? 0;
      }
      let total = 0;
      for (const text of texts.values()) total += countIn(text, expression);
      return total;
    };

    // Dónde te frenaste, por video.
    const withStops = videos.map((video) => ({
      ...video,
      stops: stopped.filter(
        (expression) => countIn(texts.get(video.externalId) ?? "", expression) > 0
      ).length,
    }));

    const videosWith = (expression: string): CorpusVideo[] => {
      const parts = tokenize(expression);
      if (parts.length === 1) {
        const lemma = isReady ? lemmatize(parts[0], rank) : parts[0];
        const ids = words.get(lemma)?.videos ?? new Set<string>();
        return withStops.filter((v) => ids.has(v.externalId));
      }
      return withStops.filter(
        (v) => countIn(texts.get(v.externalId) ?? "", expression) > 0
      );
    };

    const suggestSpelling = (expression: string): string | null => {
      const parts = tokenize(expression);
      if (parts.length !== 1 || !isReady) return null;
      const word = parts[0];
      if (rank(word) !== null) return null;
      // La sugerencia solo vale si es una palabra bastante usada: parecerse a
      // un término rarísimo no es evidencia de nada.
      const limit = Math.min(frequency.words.length, 20_000);
      for (let i = 0; i < limit; i += 1) {
        if (isOneEditAway(word, frequency.words[i])) return frequency.words[i];
      }
      return null;
    };

    /**
     * Las frases donde de verdad se dijo, sacadas de tus videos.
     *
     * Es lo que reemplaza al ejemplo inventado del diccionario: en vez de
     * "I came across this tool", la frase exacta que escuchaste, con el link
     * al segundo en que suena.
     */
    const examples = (expression: string, limit = 4): CorpusExample[] => {
      const parts = tokenize(expression);
      if (parts.length === 0) return [];
      const lemma = isReady ? lemmatize(parts[0], rank) : parts[0];
      const needle = parts.join(" ");
      const out: CorpusExample[] = [];

      for (const video of withStops) {
        for (const cue of cuesById.get(video.externalId) ?? []) {
          const hit =
            parts.length === 1
              ? tokenize(cue.text).some(
                  (token) => (isReady ? lemmatize(token, rank) : token) === lemma
                )
              : cue.text.toLowerCase().includes(needle);
          if (!hit) continue;

          out.push({
            externalId: video.externalId,
            title: video.title,
            seconds: cue.t,
            text: cue.text,
          });
          if (out.length >= limit) return out;
        }
      }
      return out;
    };

    return {
      isLoading: freqLoading || transcriptsLoading,
      isReady: isReady && transcripts.length > 0,
      rank,
      videoCount: withStops.length,
      totalTokens: withStops.reduce((acc, v) => acc + v.tokens, 0),
      distinctLemmas: words.size,
      videos: withStops,
      bandTokens: totals,
      occurrences,
      videosWith,
      rankOf: (expression: string) => expressionRank(expression, rank),
      suggestSpelling,
      examples,
    };
  }, [
    index,
    isReady,
    rank,
    frequency.words,
    freqLoading,
    transcriptsLoading,
    transcripts.length,
    stopped,
  ]);
}
