import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/integrations/supabase/session";
import { toast } from "sonner";
import { optimistic } from "./optimistic";

export interface CategoryLimit {
  id: string;
  user_id: string;
  category_name: string;
  monthly_limit: number;
  alert_at_percentage: number;
  created_at: string;
  updated_at: string;
}

type LimitInput = Pick<CategoryLimit, "category_name" | "monthly_limit" | "alert_at_percentage">;

const LIMITS_KEY = ["category_limits"];

export const categoryLimitsQuery = queryOptions({
  queryKey: LIMITS_KEY,
  queryFn: async () => {
    const { data, error } = await supabase.from("category_limits").select("*").order("category_name");
    if (error) throw error;
    return data as CategoryLimit[];
  },
});

const upsertInList = (list: CategoryLimit[], limit: LimitInput) => {
  const existing = list.find((l) => l.category_name === limit.category_name);
  if (existing) return list.map((l) => (l === existing ? { ...l, ...limit } : l));
  const now = new Date().toISOString();
  return [...list, { ...limit, id: `pending-${limit.category_name}`, user_id: "", created_at: now, updated_at: now }];
};

export function useCategoryLimits() {
  const queryClient = useQueryClient();
  const { data: limits = [], isLoading } = useQuery(categoryLimitsQuery);

  const upsertLimit = useMutation({
    mutationFn: async (limit: LimitInput) => {
      const userId = await requireUserId();
      const { error } = await supabase
        .from("category_limits")
        .upsert({ user_id: userId, ...limit }, { onConflict: "user_id,category_name" });
      if (error) throw error;
    },
    ...optimistic<CategoryLimit[], LimitInput>(queryClient, LIMITS_KEY, upsertInList),
    onSuccess: () => toast.success("Límite actualizado"),
  });

  const deleteLimit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("category_limits").delete().eq("id", id);
      if (error) throw error;
    },
    ...optimistic<CategoryLimit[], string>(queryClient, LIMITS_KEY, (list, id) => list.filter((l) => l.id !== id)),
    onSuccess: () => toast.success("Límite eliminado"),
  });

  return { limits, isLoading, upsertLimit, deleteLimit };
}
