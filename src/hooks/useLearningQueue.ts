import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ContentType } from "@/lib/learning-config";
import { fetchVideoOEmbed } from "@/lib/oembed";

export interface QueueItem {
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
  note: string | null;
  watched_at: string | null;
  session_id: string | null;
  created_at: string;
}

export type QueueDraft = Pick<
  QueueItem,
  | "content_type"
  | "content_url"
  | "external_id"
  | "content_title"
  | "content_thumbnail"
  | "note"
>;

/** Contenido guardado para ver más adelante. */
export function useLearningQueue(goalId?: string) {
  const queryClient = useQueryClient();

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["learning-queue", goalId ?? "all"],
    enabled: !!goalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_queue")
        .select("*")
        .eq("goal_id", goalId!)
        .is("watched_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as QueueItem[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["learning-queue"] });

  const add = useMutation({
    mutationFn: async (draft: Partial<QueueDraft> & { goal_id: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      // Sin título la lista es inútil: "video guardado" no le dice nada a
      // nadie una semana después. Se resuelve antes de insertar.
      let meta: { content_title?: string; content_author?: string } = {};
      if (draft.external_id && !draft.content_title) {
        const found = await fetchVideoOEmbed(draft.external_id);
        if (found?.title) {
          meta = {
            content_title: found.title,
            ...(found.author ? { content_author: found.author } : {}),
          };
        }
      }

      const { data, error } = await supabase
        .from("learning_queue")
        .insert({ ...draft, ...meta, user_id: userData.user.id })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Ese video ya está en tu lista");
        }
        throw error;
      }
      return data as QueueItem;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Guardado para después");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /** Lo saca de la lista al empezar a verlo. */
  const markWatched = useMutation({
    mutationFn: async ({ id, sessionId }: { id: string; sessionId: string }) => {
      const { error } = await supabase
        .from("learning_queue")
        .update({ watched_at: new Date().toISOString(), session_id: sessionId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("learning_queue").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Sacado de la lista");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { queue, isLoading, add, markWatched, remove };
}
