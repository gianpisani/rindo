import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { normalizeLookup } from "@/lib/transcript";
import { detectItemType } from "@/lib/learning-config";
import {
  dictionaryKey,
  fetchDictionaryEntry,
  type DictionaryEntry,
} from "./useDictionary";
import {
  fetchTranslations,
  translationsKey,
  uniqueTexts,
} from "./useTranslation";
import type { SessionItem, useLearningItems } from "./useLearningItems";

const PREF_KEY = "rindo:learning-auto-capture";

export function readAutoCapturePref(): boolean {
  return localStorage.getItem(PREF_KEY) === "1";
}

interface AutoCaptureArgs {
  goalId: string;
  sessionId: string;
  capture: ReturnType<typeof useLearningItems>["capture"];
  updateItem: ReturnType<typeof useLearningItems>["updateItem"];
}

/**
 * Modo automático: tocar una palabra la guarda sin apretar Guardar.
 *
 * Lo único que cambia respecto al modo normal es eso: la ficha con diccionario
 * y traducción se muestra igual, y el video se pausa igual.
 *
 * El guardado ocurre en dos tiempos a propósito. Primero se graba la expresión
 * con su frase y su minuto, que es instantáneo y hace aparecer la fila al tiro.
 * Después, cuando el diccionario y el traductor responden, se completa el
 * significado en inglés, en español y la traducción. Así tocar una palabra
 * nunca se siente lento, aunque las dos APIs tarden.
 */
export function useAutoCapture({
  goalId,
  sessionId,
  capture,
  updateItem,
}: AutoCaptureArgs) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(readAutoCapturePref);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(PREF_KEY, next ? "1" : "0");
      toast[next ? "success" : "info"](
        next ? "Modo automático activado" : "Modo automático apagado",
        {
          description: next
            ? "Cada palabra que toques se guarda sola con su significado."
            : "Volviste al formulario para revisar antes de guardar.",
        }
      );
      return next;
    });
  }, []);

  /** Enriquece la expresión en segundo plano, sin bloquear nada. */
  const enrich = useCallback(
    async (itemId: string, term: string) => {
      const normalized = normalizeLookup(term);
      if (!normalized) return;

      const entry = await queryClient
        .fetchQuery<DictionaryEntry | null>({
          queryKey: dictionaryKey(normalized),
          queryFn: () => fetchDictionaryEntry(normalized),
          staleTime: Infinity,
        })
        .catch(() => null);

      const definition = entry?.senses[0]?.definition ?? null;
      const wanted = uniqueTexts([normalized, ...(definition ? [definition] : [])]);

      const translations = await queryClient
        .fetchQuery<Record<string, string>>({
          queryKey: translationsKey(wanted),
          queryFn: () => fetchTranslations(wanted),
          staleTime: Infinity,
        })
        .catch(() => ({}) as Record<string, string>);

      const updates = {
        meaning: definition,
        meaning_es: definition ? (translations[definition] ?? null) : null,
        translation_es: translations[normalized] ?? null,
      };

      // Si no se consiguió nada, no vale la pena escribir.
      if (!updates.meaning && !updates.translation_es) return;

      updateItem.mutate({ id: itemId, ...updates });

      // La fila de la sesión se actualiza en el momento, sin refetch, para que
      // la traducción aparezca sola bajo la expresión recién guardada.
      queryClient.setQueryData<SessionItem[]>(
        ["learning-session-items", sessionId],
        (old = []) =>
          old.map((row) => (row.id === itemId ? { ...row, ...updates } : row))
      );
    },
    [queryClient, updateItem, sessionId]
  );

  /** Guarda la palabra al toque y la completa después. */
  const captureNow = useCallback(
    (term: string, contextText: string | null, timestampSeconds: number | null) => {
      const value = term.trim();
      if (!value) return;

      capture.mutate(
        {
          goal_id: goalId,
          session_id: sessionId,
          expression: value,
          context: contextText,
          timestamp_seconds: timestampSeconds,
          item_type: detectItemType(value),
        },
        {
          onSuccess: (result) => {
            if (!result.was_new) {
              toast.success(`“${result.item.expression}” otra vez`, {
                description: `La has visto ${result.item.times_seen} veces`,
              });
            }
            // Solo se busca si aún le falta información.
            if (!result.item.meaning || !result.item.translation_es) {
              void enrich(result.item.id, value);
            }
          },
        }
      );
    },
    [capture, goalId, sessionId, enrich]
  );

  return { enabled, toggle, captureNow, enrich };
}
