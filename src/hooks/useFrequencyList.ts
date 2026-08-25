import { useQuery } from "@tanstack/react-query";
import { FREQUENCY_LIST_URL, type RankLookup } from "@/lib/corpus";

export interface FrequencyList {
  /** Puesto de una palabra en el ranking de uso del inglés. null = no está. */
  rank: RankLookup;
  /** Las palabras en orden, para buscar erratas por parecido. */
  words: string[];
}

const EMPTY: FrequencyList = { rank: () => null, words: [] };

/**
 * El ranking de uso del inglés hablado: 46.717 palabras ordenadas por
 * frecuencia, sacadas de un corpus de subtítulos (OpenSubtitles vía el
 * proyecto FrequencyWords). Subtítulos y no libros a propósito: mide el
 * inglés que se habla, que es justo el que Gianfranco consume.
 *
 * Son 370 KB de texto plano que el servidor manda comprimidos. Va aparte del
 * bundle y se baja una sola vez, la primera vez que entras a Aprendizaje.
 */
export function useFrequencyList() {
  const { data, isLoading } = useQuery({
    queryKey: ["frequency-list", "en"],
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: async (): Promise<FrequencyList> => {
      const res = await fetch(FREQUENCY_LIST_URL);
      if (!res.ok) throw new Error("No pude cargar la lista de frecuencias");

      const words = (await res.text()).split("\n").filter(Boolean);
      const ranks = new Map<string, number>();
      words.forEach((word, index) => ranks.set(word, index + 1));

      return { rank: (word) => ranks.get(word) ?? null, words };
    },
  });

  return { frequency: data ?? EMPTY, isReady: !!data, isLoading };
}
