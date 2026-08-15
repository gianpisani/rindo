import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LearningGoal {
  id: string;
  user_id: string;
  topic: string;
  emoji: string;
  north_star: string | null;
  level_current: string | null;
  level_target: string | null;
  daily_minutes_target: number;
  weekly_days_target: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type LearningGoalDraft = Pick<
  LearningGoal,
  "topic" | "emoji" | "north_star" | "level_current" | "level_target" |
  "daily_minutes_target" | "weekly_days_target"
>;

export function useLearningGoals() {
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["learning-goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_goals")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data as LearningGoal[];
    },
  });

  const activeGoals = goals.filter((g) => g.is_active);

  const createGoal = useMutation({
    mutationFn: async (draft: Partial<LearningGoalDraft> & { topic: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("learning_goals")
        .insert({ ...draft, user_id: userData.user.id })
        .select()
        .single();
      if (error) throw error;
      return data as LearningGoal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning-goals"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateGoal = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LearningGoal> & { id: string }) => {
      const { data, error } = await supabase
        .from("learning_goals")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as LearningGoal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning-goals"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("learning_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning-goals"] });
      queryClient.invalidateQueries({ queryKey: ["learning-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["learning-items"] });
      toast.success("Objetivo eliminado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { goals, activeGoals, isLoading, createGoal, updateGoal, deleteGoal };
}
