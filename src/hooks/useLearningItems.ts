import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ItemType, Mastery } from "@/lib/learning-config";

export interface LearningItem {
  id: string;
  user_id: string;
  goal_id: string;
  first_session_id: string | null;
  expression: string;
  normalized: string;
  item_type: ItemType;
  meaning: string | null;
  meaning_es: string | null;
  translation_es: string | null;
  my_sentence: string | null;
  mastery: Mastery;
  times_seen: number;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface ItemSighting {
  id: string;
  item_id: string;
  session_id: string | null;
  context: string | null;
  timestamp_seconds: number | null;
  created_at: string;
  // Del join con la sesión
  session_title: string | null;
  session_external_id: string | null;
  session_content_type: string | null;
}

/** Una expresión tal como se ve en el panel de la sesión. */
export interface SessionItem {
  sighting_id: string;
  timestamp_seconds: number | null;
  context: string | null;
  id: string;
  expression: string;
  item_type: ItemType;
  is_new: boolean;
  /** Se completan solas al capturar; sirven para revisar sin salir del video. */
  translation_es: string | null;
  meaning: string | null;
  meaning_es: string | null;
  /** Todavía no confirmada por el servidor. */
  pending?: boolean;
}

/** Misma normalización que hace la base, para deduplicar en el cliente. */
export function normalizeExpression(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface CaptureInput {
  goal_id: string;
  session_id: string;
  expression: string;
  context?: string | null;
  timestamp_seconds?: number | null;
  item_type?: ItemType;
  meaning?: string | null;
  meaning_es?: string | null;
  translation_es?: string | null;
}

export function useLearningItems(goalId?: string) {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["learning-items", goalId ?? "all"],
    enabled: !!goalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_items")
        .select("*")
        .eq("goal_id", goalId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LearningItem[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["learning-items"] });
    queryClient.invalidateQueries({ queryKey: ["learning-sightings-by-session"] });
  };

  /**
   * Captura una expresión. Si ya la habías guardado antes no se duplica:
   * queda registrada como un avistamiento nuevo, que es lo que permite ver
   * después que una expresión reapareció en otro contenido.
   *
   * Se pinta en la lista antes de que responda el servidor: durante una sesión
   * esperar un viaje de red por cada palabra rompe el ritmo. Si falla, se
   * deshace y se avisa.
   */
  const capture = useMutation({
    mutationFn: async (input: CaptureInput) => {
      const { data, error } = await supabase.rpc("capture_learning_expression", {
        p_goal_id: input.goal_id,
        p_session_id: input.session_id,
        p_expression: input.expression,
        p_context: input.context ?? undefined,
        p_timestamp_seconds: input.timestamp_seconds ?? undefined,
        p_item_type: input.item_type ?? "expression",
        p_meaning: input.meaning ?? undefined,
        p_translation_es: input.translation_es ?? undefined,
        p_meaning_es: input.meaning_es ?? undefined,
      });
      if (error) throw error;
      return data as unknown as { item: LearningItem; was_new: boolean };
    },

    onMutate: async (input) => {
      const key = ["learning-session-items", input.session_id];
      await queryClient.cancelQueries({ queryKey: key });

      const previous = queryClient.getQueryData<SessionItem[]>(key);
      const normalized = normalizeExpression(input.expression);

      const optimistic: SessionItem = {
        sighting_id: `pending-${normalized}-${previous?.length ?? 0}`,
        timestamp_seconds: input.timestamp_seconds ?? null,
        context: input.context ?? null,
        id: `pending-${normalized}`,
        expression: input.expression.trim(),
        item_type: input.item_type ?? "expression",
        // Ya sabemos si es nueva mirando el diccionario que está en memoria
        is_new: !items.some((i) => i.normalized === normalized),
        translation_es: input.translation_es ?? null,
        meaning: input.meaning ?? null,
        meaning_es: input.meaning_es ?? null,
        pending: true,
      };

      queryClient.setQueryData<SessionItem[]>(key, [
        ...(previous ?? []),
        optimistic,
      ]);

      return { key, previous, optimisticId: optimistic.sighting_id };
    },

    onSuccess: (result, _input, context) => {
      if (!context) return;
      // Se reemplaza la fila provisional en su lugar, sin refetch:
      // invalidar acá haría parpadear la lista completa.
      queryClient.setQueryData<SessionItem[]>(context.key, (old = []) =>
        old.map((row) =>
          row.sighting_id === context.optimisticId
            ? {
                ...row,
                id: result.item.id,
                expression: result.item.expression,
                is_new: result.was_new,
                translation_es: result.item.translation_es,
                meaning: result.item.meaning,
                meaning_es: result.item.meaning_es,
                pending: false,
              }
            : row
        )
      );
      // El diccionario y los conteos sí se refrescan: no están a la vista.
      invalidate();
    },

    onError: (error: Error, _input, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
      toast.error(error.message);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LearningItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("learning_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as LearningItem;
    },
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("learning_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Expresión eliminada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { items, isLoading, capture, updateItem, deleteItem };
}

/** Todos los avistamientos de una expresión, con el contenido donde apareció. */
export function useItemSightings(itemId?: string) {
  return useQuery({
    queryKey: ["learning-item-sightings", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_item_sightings")
        .select(
          "id, item_id, session_id, context, timestamp_seconds, created_at, " +
            "learning_sessions(content_title, external_id, content_type)"
        )
        .eq("item_id", itemId!)
        .order("created_at");
      if (error) throw error;

      type SightingRow = {
        id: string;
        item_id: string;
        session_id: string | null;
        context: string | null;
        timestamp_seconds: number | null;
        created_at: string;
        learning_sessions: {
          content_title: string | null;
          external_id: string | null;
          content_type: string | null;
        } | null;
      };

      return ((data ?? []) as unknown as SightingRow[]).map((row) => ({
        id: row.id,
        item_id: row.item_id,
        session_id: row.session_id,
        context: row.context,
        timestamp_seconds: row.timestamp_seconds,
        created_at: row.created_at,
        session_title: row.learning_sessions?.content_title ?? null,
        session_external_id: row.learning_sessions?.external_id ?? null,
        session_content_type: row.learning_sessions?.content_type ?? null,
      })) as ItemSighting[];
    },
  });
}

/** Expresiones capturadas durante una sesión concreta (para el resumen final). */
export function useSessionItems(sessionId?: string) {
  return useQuery({
    queryKey: ["learning-session-items", sessionId],
    enabled: !!sessionId,
    // La lista la mantiene al día la propia captura. Refetchear al volver a la
    // pestaña solo produciría un parpadeo en mitad de la sesión.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_item_sightings")
        .select(
          "id, timestamp_seconds, context, " +
            "learning_items(id, expression, item_type, first_session_id, " +
            "translation_es, meaning, meaning_es)"
        )
        .eq("session_id", sessionId!)
        .order("created_at");
      if (error) throw error;

      type SessionItemRow = {
        id: string;
        timestamp_seconds: number | null;
        context: string | null;
        learning_items: {
          id: string;
          expression: string;
          item_type: ItemType;
          first_session_id: string | null;
          translation_es: string | null;
          meaning: string | null;
          meaning_es: string | null;
        } | null;
      };

      return ((data ?? []) as unknown as SessionItemRow[])
        .filter((row) => !!row.learning_items)
        .map<SessionItem>((row) => ({
          sighting_id: row.id,
          timestamp_seconds: row.timestamp_seconds,
          context: row.context,
          id: row.learning_items!.id,
          expression: row.learning_items!.expression,
          item_type: row.learning_items!.item_type,
          is_new: row.learning_items!.first_session_id === sessionId,
          translation_es: row.learning_items!.translation_es,
          meaning: row.learning_items!.meaning,
          meaning_es: row.learning_items!.meaning_es,
        }));
    },
  });
}
