import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CategoryLimit {
  id: string;
  user_id: string;
  category_name: string;
  monthly_limit: number;
  alert_at_percentage: number;
  created_at: string;
  updated_at: string;
}

export function useCategoryLimits() {
  const queryClient = useQueryClient();

  const { data: limits = [], isLoading } = useQuery({
    queryKey: ["category_limits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_limits")
        .select("*")
        .order("category_name");

      if (error) throw error;
      return data as CategoryLimit[];
    },
  });

  const upsertLimit = useMutation({
    mutationFn: async (limit: Omit<CategoryLimit, "id" | "user_id" | "created_at" | "updated_at">) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("category_limits")
        .upsert({
          user_id: userData.user.id,
          ...limit,
        }, {
          onConflict: "user_id,category_name"
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category_limits"] });
      toast.success("Límite actualizado");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteLimit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("category_limits")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category_limits"] });
      toast.success("Límite eliminado");
    },
  });

  return {
    limits,
    isLoading,
    upsertLimit,
    deleteLimit,
  };
}
