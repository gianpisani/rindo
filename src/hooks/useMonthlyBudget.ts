import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MonthlyBudget {
  id: string;
  user_id: string;
  total_budget: number;
  created_at: string;
  updated_at: string;
}

export function useMonthlyBudget() {
  const queryClient = useQueryClient();

  const { data: budget, isLoading } = useQuery({
    queryKey: ["monthly_budget"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_budgets")
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return data as MonthlyBudget | null;
    },
  });

  const upsertBudget = useMutation({
    mutationFn: async (totalBudget: number) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("monthly_budgets")
        .upsert(
          {
            user_id: userData.user.id,
            total_budget: totalBudget,
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly_budget"] });
      toast.success("Presupuesto actualizado");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    budget,
    isLoading,
    upsertBudget,
  };
}
