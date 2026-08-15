import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseTranscript, type Cue } from "@/lib/transcript";

export interface Transcript {
  id: string;
  external_id: string;
  source: "paste" | "auto";
  lang: string;
  cues: Cue[];
  cue_count: number;
}

/**
 * Qué videos ya tienen subtítulos guardados.
 *
 * Se trae solo la lista de ids, no las líneas: sirve para marcar con un tilde
 * los de la lista de "ver después" y saber cuáles conviene adelantar.
 */
export function useTranscriptStatuses() {
  return useQuery({
    queryKey: ["learning-transcript-ids"],
    staleTime: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_transcripts")
        .select("external_id");
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.external_id));
    },
  });
}

/**
 * Transcripción cacheada de un video. Se pega una vez y queda para siempre,
 * así que a partir de la segunda sesión sobre el mismo contenido es instantánea.
 */
export function useTranscript(externalId?: string | null) {
  const queryClient = useQueryClient();

  const { data: transcript, isLoading } = useQuery({
    queryKey: ["learning-transcript", externalId],
    enabled: !!externalId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_transcripts")
        .select("*")
        .eq("external_id", externalId!)
        .maybeSingle();
      if (error) throw error;
      return data ? ({ ...data, cues: data.cues as unknown as Cue[] } as Transcript) : null;
    },
  });

  const save = useMutation({
    mutationFn: async (raw: string) => {
      if (!externalId) throw new Error("Sin video asociado");

      const cues = parseTranscript(raw);
      if (cues.length === 0) {
        throw new Error(
          "No encontré marcas de tiempo. Copia la transcripción con los minutos incluidos."
        );
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("learning_transcripts")
        .upsert(
          {
            user_id: userData.user.id,
            external_id: externalId,
            source: "paste",
            lang: "en",
            cues: cues as unknown as never,
            cue_count: cues.length,
          },
          { onConflict: "user_id,external_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return { ...data, cues } as Transcript;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["learning-transcript", externalId], saved);
      queryClient.invalidateQueries({ queryKey: ["learning-transcript-ids"] });
      toast.success(`Transcripción lista — ${saved.cue_count} líneas`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!transcript) return;
      const { error } = await supabase
        .from("learning_transcripts")
        .delete()
        .eq("id", transcript.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData(["learning-transcript", externalId], null);
      queryClient.invalidateQueries({ queryKey: ["learning-transcript-ids"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { transcript, isLoading, save, remove };
}
