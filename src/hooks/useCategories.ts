import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/integrations/supabase/session";
import { toast } from "sonner";
import { useCallback } from "react";
import { getCategoryIcon } from "@/lib/category-icon";
import type { TransactionType } from "@/lib/ledger";
import { optimistic } from "./optimistic";

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  description?: string;
  is_active?: boolean;
  color: string | null;
  icon: string | null;
  user_id: string;
  created_at: string;
}

type CategoryPatch = Partial<Category> & { id: string };

const CATEGORIES_KEY = ["categories"];

export const categoriesQuery = queryOptions({
  queryKey: CATEGORIES_KEY,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("type", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return data as Category[];
  },
});

export function useCategories() {
  const queryClient = useQueryClient();
  const { data: categories = [], isLoading } = useQuery(categoriesQuery);

  const addCategory = useMutation({
    mutationFn: async (category: Omit<Category, "id" | "user_id" | "created_at">) => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("categories")
        .insert({ ...category, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success("Categoría agregada"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...changes }: CategoryPatch) => {
      const { error } = await supabase.from("categories").update(changes).eq("id", id).select("id").single();
      if (error) throw error;
    },
    ...optimistic<Category[], CategoryPatch>(queryClient, CATEGORIES_KEY, (list, { id, ...changes }) =>
      list.map((c) => (c.id === id ? { ...c, ...changes } : c))),
    onSuccess: () => toast.success("Categoría actualizada"),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    ...optimistic<Category[], string>(queryClient, CATEGORIES_KEY, (list, id) => list.filter((c) => c.id !== id)),
    onSuccess: () => toast.success("Categoría eliminada"),
  });

  const emojiOf = useCallback((name: string) => categories.find((c) => c.name === name)?.icon || getCategoryIcon(name), [categories]);
  const colorOf = useCallback((name: string) => categories.find((c) => c.name === name)?.color ?? null, [categories]);

  return { categories, isLoading, addCategory, updateCategory, deleteCategory, emojiOf, colorOf };
}
