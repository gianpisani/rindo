import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemo } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export interface TrainingGoal {
  id: string;
  user_id: string;
  goal_type: string;
  sport_type: string | null;
  target_value: number;
  race_distance: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalData {
  goal_type: string;
  sport_type?: string | null;
  target_value: number;
  race_distance?: string | null;
  start_date: string;
  end_date?: string | null;
}

export function useTrainingGoals() {
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["training-goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_goals")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TrainingGoal[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["training-goals"] });

  const createGoal = useMutation({
    mutationFn: async (data: CreateGoalData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user");
      const { error } = await supabase.from("training_goals").insert({
        user_id: userData.user.id,
        ...data,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Meta creada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteGoal = useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase
        .from("training_goals")
        .update({ is_active: false })
        .eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Meta eliminada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Compute progress for each goal by querying sessions
  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const { data: weekSessions = [] } = useQuery({
    queryKey: ["training-sessions-week-goals", weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("*")
        .gte("session_date", weekStart)
        .lte("session_date", weekEnd)
        .eq("status", "completed");
      if (error) throw error;
      return data;
    },
    enabled: goals.length > 0,
  });

  const { data: monthSessions = [] } = useQuery({
    queryKey: ["training-sessions-month-goals", monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("*")
        .gte("session_date", monthStart)
        .lte("session_date", monthEnd)
        .eq("status", "completed");
      if (error) throw error;
      return data;
    },
    enabled: goals.length > 0,
  });

  const progress = useMemo(() => {
    const map: Record<string, { current: number; target: number; pct: number }> = {};

    for (const goal of goals) {
      const isWeekly = goal.goal_type.startsWith("weekly_");
      const sessions = isWeekly ? weekSessions : monthSessions;
      const filtered = goal.sport_type
        ? sessions.filter((s: Record<string, unknown>) => s.sport_type === goal.sport_type)
        : sessions;

      let current = 0;
      if (goal.goal_type.includes("distance")) {
        current = filtered.reduce(
          (sum: number, s: Record<string, unknown>) =>
            sum + ((s.target_distance_meters as number) || 0) / 1000,
          0
        );
      } else if (goal.goal_type.includes("duration")) {
        current = filtered.reduce(
          (sum: number, s: Record<string, unknown>) =>
            sum + ((s.target_duration_minutes as number) || 0),
          0
        );
      } else if (goal.goal_type.includes("sessions")) {
        current = filtered.length;
      }

      const pct = goal.target_value > 0
        ? Math.min(100, Math.round((current / goal.target_value) * 100))
        : 0;

      map[goal.id] = { current, target: goal.target_value, pct };
    }

    return map;
  }, [goals, weekSessions, monthSessions]);

  return {
    goals,
    isLoading,
    progress,
    createGoal,
    deleteGoal,
  };
}
