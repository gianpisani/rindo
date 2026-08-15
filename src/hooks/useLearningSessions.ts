import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { contentProgress, type ContentType, type Difficulty } from "@/lib/learning-config";

export interface LearningSession {
  id: string;
  user_id: string;
  goal_id: string;

  content_type: ContentType;
  content_url: string | null;
  external_id: string | null;
  content_title: string | null;
  content_author: string | null;
  content_thumbnail: string | null;
  content_duration_seconds: number | null;

  status: "active" | "paused" | "completed";
  started_at: string;
  ended_at: string | null;
  last_resumed_at: string | null;
  last_heartbeat_at: string | null;
  effective_seconds: number;
  consumed_seconds: number;
  elapsed_seconds: number | null;
  pause_count: number;
  last_position_seconds: number;

  comp_main_idea: number | null;
  comp_details: number | null;
  comp_subtitles: number | null;
  comp_explain: number | null;
  main_idea_text: string | null;
  difficulty: Difficulty | null;

  created_at: string;
  updated_at: string;
}

/** Sesión completada + cuántas expresiones se capturaron en ella. */
export interface SessionWithItemCount extends LearningSession {
  item_count: number;
  new_item_count: number;
}

export function useLearningSessions(goalId?: string) {
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["learning-sessions", goalId ?? "all"],
    enabled: !!goalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_sessions")
        .select("*")
        .eq("goal_id", goalId!)
        .eq("status", "completed")
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data as LearningSession[];
    },
  });

  // Avistamientos por sesión → cuántas expresiones capturaste en cada una.
  const { data: sightingsBySession = {} } = useQuery({
    queryKey: ["learning-sightings-by-session", goalId ?? "all"],
    enabled: !!goalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_item_sightings")
        .select("session_id, item_id, learning_items!inner(goal_id, first_session_id)")
        .eq("learning_items.goal_id", goalId!);
      if (error) throw error;

      type SightingRow = {
        session_id: string | null;
        item_id: string;
        learning_items: { goal_id: string; first_session_id: string | null } | null;
      };

      const map: Record<string, { total: number; fresh: number }> = {};
      for (const row of (data ?? []) as unknown as SightingRow[]) {
        if (!row.session_id) continue;
        const entry = (map[row.session_id] ??= { total: 0, fresh: 0 });
        entry.total += 1;
        // "Nueva" = esta sesión fue la primera vez que viste la expresión.
        if (row.learning_items?.first_session_id === row.session_id) entry.fresh += 1;
      }
      return map;
    },
  });

  const sessionsWithCounts: SessionWithItemCount[] = sessions.map((s) => ({
    ...s,
    item_count: sightingsBySession[s.id]?.total ?? 0,
    new_item_count: sightingsBySession[s.id]?.fresh ?? 0,
  }));

  /**
   * Contenidos que quedaron a medias y vale la pena retomar.
   *
   * Se agrupa por video y se mira solo la sesión más reciente de cada uno: si
   * después lo terminaste, deja de ofrecerse. Dejar algo a la mitad es
   * legítimo —la sesión cuenta igual— pero conviene poder volver.
   */
  const unfinished = useMemo(() => {
    const seen = new Set<string>();
    const out: SessionWithItemCount[] = [];

    // sessionsWithCounts viene de la más reciente a la más antigua
    for (const s of sessionsWithCounts) {
      if (!s.external_id || seen.has(s.external_id)) continue;
      seen.add(s.external_id);
      if (contentProgress(s).isPartial) out.push(s);
    }

    return out;
  }, [sessionsWithCounts]);

  /**
   * Saca un contenido de "seguir viendo" sin tocar nada más: se marca la
   * posición al final, que es lo que decide si sigue apareciendo.
   */
  const markContentFinished = useMutation({
    mutationFn: async (session: LearningSession) => {
      const { error } = await supabase
        .from("learning_sessions")
        .update({
          last_position_seconds: session.content_duration_seconds ?? 0,
        })
        .eq("id", session.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning-sessions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteSession = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("learning_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["learning-sightings-by-session"] });
      toast.success("Sesión eliminada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    sessions: sessionsWithCounts,
    unfinished,
    isLoading,
    deleteSession,
    markContentFinished,
  };
}

/**
 * Fecha de la última sesión completada de cualquier objetivo activo.
 * La usa el recordatorio del inicio, sin cargar todo el historial.
 */
export function useLastLearningSession() {
  return useQuery({
    queryKey: ["learning-last-session"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_sessions")
        .select("id, started_at, goal_id, content_title")
        .eq("status", "completed")
        .order("started_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as
        | Pick<LearningSession, "id" | "started_at" | "goal_id" | "content_title">
        | null;
    },
    staleTime: 1000 * 60 * 5,
  });
}
