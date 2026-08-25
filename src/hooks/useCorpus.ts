import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchVideoOEmbed } from "@/lib/oembed";
import type { Cue } from "@/lib/transcript";
import {
  bandOf,
  effectiveRank,
  expressionRank,
  isOneEditAway,
  lemmatize,
  tokenize,
  type BandKey,
  type RankLookup,
} from "@/lib/corpus";
import { lexicalDifficulty } from "@/lib/progress";
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
  /** 0–100: cuánto de lo dicho está fuera de las mil palabras más usadas. */
  difficulty: number | null;
  /** Cuántas de tus capturas aparecen acá. */
  stops: number;
  /** Lo viste (tiene sesión) o solo tienes la transcripción lista. */
  watched: boolean;
}

/** Una frase real de tus videos donde se dice la expresión. */
export interface CorpusExample {
  externalId: string;
  title: string | null;
  seconds: number;
  text: string;
}

export interface Corpus {
  isLoading: boolean;
  /** Sin lista de frecuencias no hay bandas ni lemas: la UI se muestra sobria. */
  isReady: boolean;
  rank: RankLookup;

  /** Lo que efectivamente escuchaste: videos con sesión. */
  videos: CorpusVideo[];
  /** Transcripciones listas de cosas que todavía no ves. */
  upcoming: CorpusVideo[];
  videoCount: number;
  totalTokens: number;
  distinctLemmas: number;
  bandTokens: Record<BandKey, number>;

  /** Veces que una expresión aparece en lo que ya escuchaste. */
  occurrences: (expression: string) => number;
  /** Veces que aparece en lo que tienes por ver: deuda futura. */
  upcomingOccurrences: (expression: string) => number;
  videosWith: (expression: string) => CorpusVideo[];
  rankOf: (expression: string) => number | null;
  suggestSpelling: (expression: string) => string | null;
  examples: (expression: string, limit?: number) => CorpusExample[];
  /** El video del corpus que corresponde a una sesión. */
  videoOf: (externalId: string | null) => CorpusVideo | null;
}

interface TranscriptRow {
  external_id: string;
  cues: Cue[];
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
 * Títulos que no salen de ninguna tabla.
 *
 * Pasa cuando borras la sesión o cuando pegaste la transcripción antes de
 * encolar el video: queda el id de YouTube y nada más. Antes se mostraba el id
 * pelado —"FylHa4_neOA"— que no le dice nada a nadie. YouTube devuelve el
 * título por oEmbed sin pedir API key.
 */
function useMissingTitles(ids: string[]) {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["video-oembed", id],
      staleTime: Infinity,
      gcTime: Infinity,
      retry: false,
      queryFn: () => fetchVideoOEmbed(id),
    })),
  });

  // Los títulos llegan de a uno; la firma cambia cuando se resuelve otro.
  const signature = results.map((r) => r.data?.title ?? "").join("|");

  return useMemo(() => {
    const map = new Map<string, string>();
    ids.forEach((id, index) => {
      const title = results[index]?.data?.title;
      if (title) map.set(id, title);
    });
    return map;
  }, [ids, signature]); // eslint-disable-line react-hooks/exhaustive-deps
}

export interface CorpusInput {
  /** Título conocido de cada video, de las sesiones y de la cola. */
  titles: Map<string, string | null>;
  /** Los videos que de verdad viste: los que tienen sesión. */
  watchedIds: Set<string>;
  /** Las expresiones que capturaste, para marcar dónde te frenaste. */
  stopped: string[];
}

/**
 * El corpus: el inglés que escuchaste, indexado contra el ranking de uso.
 *
 * Distingue lo visto de lo que solo tiene la transcripción cargada. Da lo
 * mismo para buscar en el diccionario, pero es la diferencia entre medir tu
 * exposición real y medir tu entusiasmo pegando subtítulos: si todo contara
 * igual, preparar cinco videos de la cola inflaría el corpus sin que hayas
 * escuchado una palabra.
 */
export function useCorpus({ titles, watchedIds, stopped }: CorpusInput): Corpus {
  const { frequency, isReady, isLoading: freqLoading } = useFrequencyList();
  const { data: transcripts = [], isLoading: transcriptsLoading } =
    useTranscriptCorpus();

  const rank = frequency.rank;

  const unknownIds = useMemo(
    () =>
      transcripts
        .map((t) => t.external_id)
        .filter((id) => !titles.get(id))
        .sort(),
    [transcripts, titles]
  );
  const fetchedTitles = useMissingTitles(unknownIds);

  const index = useMemo(() => {
    // lema → { veces dicho, en qué videos }
    const words = new Map<string, { count: number; videos: Set<string> }>();
    const upcomingWords = new Map<string, number>();
    const videos: CorpusVideo[] = [];
    const texts = new Map<string, string>();
    const cuesById = new Map<string, Cue[]>();
    const totals = emptyBands();

    for (const transcript of transcripts) {
      const watched = watchedIds.has(transcript.external_id);
      texts.set(transcript.external_id, transcript.text);
      cuesById.set(transcript.external_id, transcript.cues);

      const tokens = tokenize(transcript.text);
      const bandTokens = emptyBands();
      const seen = new Set<string>();

      for (const token of tokens) {
        const lemma = isReady ? lemmatize(token, rank) : token;
        seen.add(lemma);

        if (watched) {
          const entry = words.get(lemma) ?? { count: 0, videos: new Set<string>() };
          entry.count += 1;
          entry.videos.add(transcript.external_id);
          words.set(lemma, entry);
        } else {
          upcomingWords.set(lemma, (upcomingWords.get(lemma) ?? 0) + 1);
        }

        const key = bandOf(isReady ? effectiveRank(lemma, rank) : null).key;
        bandTokens[key] += 1;
        if (watched) totals[key] += 1;
      }

      videos.push({
        externalId: transcript.external_id,
        title:
          titles.get(transcript.external_id) ??
          fetchedTitles.get(transcript.external_id) ??
          null,
        tokens: tokens.length,
        distinct: seen.size,
        bandTokens,
        difficulty: isReady ? lexicalDifficulty(bandTokens) : null,
        stops: 0,
        watched,
      });
    }

    return { words, upcomingWords, videos, texts, cuesById, totals };
  }, [transcripts, isReady, rank, titles, fetchedTitles, watchedIds]);

  return useMemo(() => {
    const { words, upcomingWords, videos, texts, cuesById, totals } = index;

    const lemmaOf = (word: string) => (isReady ? lemmatize(word, rank) : word);

    /**
     * Una palabra suelta se cuenta por su lema; algo de varias palabras se
     * busca literal en el texto, porque su lema no existe.
     */
    const countIn = (text: string, expression: string): number => {
      const parts = tokenize(expression);
      if (parts.length === 0) return 0;
      if (parts.length === 1) {
        const lemma = lemmaOf(parts[0]);
        return tokenize(text).filter((token) => lemmaOf(token) === lemma).length;
      }
      return text.split(parts.join(" ")).length - 1;
    };

    // Dónde te frenaste, por video.
    const withStops = videos.map((video) => ({
      ...video,
      stops: stopped.filter(
        (expression) => countIn(texts.get(video.externalId) ?? "", expression) > 0
      ).length,
    }));

    const watched = withStops.filter((v) => v.watched);
    const upcoming = withStops.filter((v) => !v.watched);

    const countAcross = (list: CorpusVideo[], expression: string) =>
      list.reduce(
        (acc, video) => acc + countIn(texts.get(video.externalId) ?? "", expression),
        0
      );

    const occurrences = (expression: string): number => {
      const parts = tokenize(expression);
      if (parts.length === 1) return words.get(lemmaOf(parts[0]))?.count ?? 0;
      return countAcross(watched, expression);
    };

    const upcomingOccurrences = (expression: string): number => {
      const parts = tokenize(expression);
      if (parts.length === 1) return upcomingWords.get(lemmaOf(parts[0])) ?? 0;
      return countAcross(upcoming, expression);
    };

    const videosWith = (expression: string): CorpusVideo[] => {
      const parts = tokenize(expression);
      if (parts.length === 1) {
        const ids = words.get(lemmaOf(parts[0]))?.videos ?? new Set<string>();
        return watched.filter((v) => ids.has(v.externalId));
      }
      return watched.filter(
        (v) => countIn(texts.get(v.externalId) ?? "", expression) > 0
      );
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
      const lemma = lemmaOf(parts[0]);
      const needle = parts.join(" ");
      const out: CorpusExample[] = [];

      for (const video of withStops) {
        for (const cue of cuesById.get(video.externalId) ?? []) {
          const hit =
            parts.length === 1
              ? tokenize(cue.text).some((token) => lemmaOf(token) === lemma)
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

    return {
      isLoading: freqLoading || transcriptsLoading,
      isReady: isReady && watched.length > 0,
      rank,
      videos: watched,
      upcoming,
      videoCount: watched.length,
      totalTokens: watched.reduce((acc, v) => acc + v.tokens, 0),
      distinctLemmas: words.size,
      bandTokens: totals,
      occurrences,
      upcomingOccurrences,
      videosWith,
      rankOf: (expression: string) => expressionRank(expression, rank),
      suggestSpelling,
      examples,
      videoOf: (externalId: string | null) =>
        externalId
          ? withStops.find((v) => v.externalId === externalId) ?? null
          : null,
    };
  }, [
    index,
    isReady,
    rank,
    frequency.words,
    freqLoading,
    transcriptsLoading,
    stopped,
  ]);
}
