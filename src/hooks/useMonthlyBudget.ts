import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/integrations/supabase/session";
import { toast } from "sonner";
import { optimistic } from "./optimistic";

export interface MonthlyBudget {
  id: string;
  user_id: string;
  total_budget: number;
  savings_goal: number | null;
  created_at: string;
  updated_at: string;
}

export type MonthlyBudgetPatch = Partial<Pick<MonthlyBudget, "total_budget" | "savings_goal">>;

const BUDGET_KEY = ["monthly_budget"];

export function useMonthlyBudget() {
  const queryClient = useQueryClient();

  const { data: budget, isLoading } = useQuery({
    queryKey: BUDGET_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("monthly_budgets").select("*").maybeSingle();
      if (error) throw error;
      return data as MonthlyBudget | null;
    },
  });

  const upsertBudget = useMutation({
    mutationFn: async (patch: MonthlyBudgetPatch) => {
      const userId = await requireUserId();
      const { error } = await supabase
        .from("monthly_budgets")
        .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    ...optimistic<MonthlyBudget | null, MonthlyBudgetPatch>(queryClient, BUDGET_KEY, (current, patch) =>
      current ? { ...current, ...patch } : current),
    onSuccess: () => toast.success("Guardado"),
  });

  return { budget, isLoading, upsertBudget };
}
