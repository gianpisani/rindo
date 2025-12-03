import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

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
  const { toast } = useToast();
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
      toast({
        title: "Límite actualizado",
        description: "El límite de categoría se ha guardado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
      toast({
        title: "Límite eliminado",
        description: "El límite de categoría se ha eliminado",
      });
    },
  });

  return {
    limits,
    isLoading,
    upsertLimit,
    deleteLimit,
  };
}
