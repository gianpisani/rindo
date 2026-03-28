import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type { TrainingSession } from "./useTrainingSessions";

export function useTodayTraining() {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["training-today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("*")
        .eq("session_date", today)
        .order("scheduled_time", { ascending: true });
      if (error) throw error;
      return data as TrainingSession[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: nextRace = null, isLoading: raceLoading } = useQuery({
    queryKey: ["training-next-race", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("*")
        .eq("is_race", true)
        .gte("session_date", today)
        .eq("status", "pending")
        .order("session_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as TrainingSession | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    sessions,
    nextRace,
    isLoading: sessionsLoading || raceLoading,
  };
}
