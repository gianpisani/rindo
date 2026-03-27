import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemo } from "react";
import { format, eachDayOfInterval } from "date-fns";

export interface TrainingSession {
  id: string;
  user_id: string;
  session_date: string;
  week_start_date: string;
  time_of_day: string;
  scheduled_time: string | null;
  sport_type: string;
  session_name: string;
  description: string | null;
  target_duration_minutes: number | null;
  target_distance_meters: number | null;
  target_hr_zone: number | null;
  target_hr_min: number | null;
  target_hr_max: number | null;
  target_pace_min_km: string | null;
  target_power_watts: number | null;
  intensity: string;
  status: string;
  garmin_activity_id: number | null;
  completed_at: string | null;
  coach_notes: string | null;
  plan_context: string | null;
  created_at: string;
  updated_at: string;
}

export type SportType = "running" | "cycling" | "swimming" | "padel" | "strength" | "rest";
export type Intensity = "easy" | "moderate" | "hard" | "recovery" | "rest";
export type SessionStatus = "pending" | "completed" | "skipped";

export function useTrainingSessions(startDate: string, endDate: string) {
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["training-sessions", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("*")
        .gte("session_date", startDate)
        .lte("session_date", endDate)
        .order("session_date", { ascending: true });

      if (error) throw error;
      return data as TrainingSession[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["training-sessions"] });

  const markCompleted = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("training_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Sesión completada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markSkipped = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("training_sessions")
        .update({ status: "skipped" })
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Sesión omitida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("training_sessions")
        .update({ status: "pending", completed_at: null })
        .eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Sesión restaurada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAllSessions = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user");
      const { error } = await supabase
        .from("training_sessions")
        .delete()
        .eq("user_id", userData.user.id)
        .gte("session_date", startDate)
        .lte("session_date", endDate);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Plan eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sessionsByDate = useMemo(() => {
    const map: Record<string, TrainingSession[]> = {};
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    const days = eachDayOfInterval({ start, end });
    for (const day of days) {
      map[format(day, "yyyy-MM-dd")] = [];
    }
    for (const session of sessions) {
      const key = session.session_date;
      if (!map[key]) map[key] = [];
      map[key].push(session);
    }
    return map;
  }, [sessions, startDate, endDate]);

  const stats = useMemo(() => {
    const total = sessions.length;
    const completed = sessions.filter((s) => s.status === "completed").length;
    const skipped = sessions.filter((s) => s.status === "skipped").length;
    const pending = sessions.filter((s) => s.status === "pending").length;
    const totalDuration = sessions.reduce(
      (sum, s) => sum + (s.target_duration_minutes || 0),
      0
    );
    const sportCounts: Record<string, number> = {};
    for (const s of sessions) {
      if (s.sport_type !== "rest") {
        sportCounts[s.sport_type] = (sportCounts[s.sport_type] || 0) + 1;
      }
    }
    return { total, completed, skipped, pending, totalDuration, sportCounts };
  }, [sessions]);

  return {
    sessions,
    isLoading,
    sessionsByDate,
    stats,
    markCompleted,
    markSkipped,
    resetSession,
    deleteAllSessions,
  };
}
