import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useCallback, useRef } from "react";

export interface Transaction {
  id: string;
  date: string; // Now TIMESTAMPTZ in Chile timezone
  detail: string | null;
  category_name: string;
  type: "Ingreso" | "Gasto" | "Inversión";
  amount: number;
  user_id: string;
  created_at: string;
}

export function useTransactions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const lastDeletedRef = useRef<Transaction[]>([]);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      console.log("🔍 Fetching transactions...");
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false });

      if (error) throw error;
      console.log("📦 Transactions fetched:", data?.length || 0);
      return data as Transaction[];
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const addTransaction = useMutation({
    mutationFn: async (transaction: Omit<Transaction, "id" | "user_id" | "created_at">) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("transactions")
        .insert({
          ...transaction,
          user_id: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({
        title: "Transacción agregada",
        description: "La transacción se ha guardado correctamente",
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

  const updateTransaction = useMutation({
    mutationFn: async ({
      id,
      ...transaction
    }: Partial<Transaction> & { id: string }) => {
      const { data, error } = await supabase
        .from("transactions")
        .update(transaction)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  // Silent update (no toast) for inline editing
  const updateTransactionSilent = useMutation({
    mutationFn: async ({
      id,
      ...transaction
    }: Partial<Transaction> & { id: string }) => {
      const { data, error } = await supabase
        .from("transactions")
        .update(transaction)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al guardar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({
        title: "Transacción eliminada",
        description: "La transacción se ha eliminado correctamente",
      });
    },
  });

  // Delete multiple transactions
  const deleteMultipleTransactions = useMutation({
    mutationFn: async (ids: string[]) => {
      // Store for undo
      const toDelete = transactions.filter(t => ids.includes(t.id));
      lastDeletedRef.current = toDelete;

      const { error } = await supabase
        .from("transactions")
        .delete()
        .in("id", ids);
      
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({
        title: `${count} transacciones eliminadas`,
        description: "Las transacciones seleccionadas han sido eliminadas. Puedes deshacer esta acción.",
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

  // Update multiple transactions (batch category/type change)
  const updateMultipleTransactions = useMutation({
    mutationFn: async ({
      ids,
      updates,
    }: {
      ids: string[];
      updates: Partial<Pick<Transaction, "category_name" | "type">>;
    }) => {
      const { error } = await supabase
        .from("transactions")
        .update(updates)
        .in("id", ids);

      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({
        title: `${count} transacciones actualizadas`,
        description: "Los cambios se han aplicado correctamente",
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

  // Duplicate transactions
  const duplicateTransactions = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const toDuplicate = transactions.filter(t => ids.includes(t.id));
      const newTransactions = toDuplicate.map(t => ({
        date: t.date,
        detail: t.detail ? `${t.detail} (copia)` : "(copia)",
        category_name: t.category_name,
        type: t.type,
        amount: t.amount,
        user_id: userData.user!.id,
      }));

      const { error } = await supabase
        .from("transactions")
        .insert(newTransactions);

      if (error) throw error;
      return newTransactions.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({
        title: `${count} transacciones duplicadas`,
        description: "Las copias se han creado correctamente",
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

  const deleteAllTransactions = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", userData.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({
        title: "Todas las transacciones eliminadas",
        description: "Se han eliminado todas tus transacciones correctamente",
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

  // Undo last batch delete
  const undoDelete = useCallback(async () => {
    if (lastDeletedRef.current.length === 0) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const toRestore = lastDeletedRef.current.map(t => ({
        date: t.date,
        detail: t.detail,
        category_name: t.category_name,
        type: t.type,
        amount: t.amount,
        user_id: userData.user!.id,
      }));

      const { error } = await supabase
        .from("transactions")
        .insert(toRestore);

      if (error) throw error;

      lastDeletedRef.current = [];
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      
      toast({
        title: "Transacciones restauradas",
        description: `Se han restaurado ${toRestore.length} transacciones`,
      });
    } catch (error: any) {
      toast({
        title: "Error al restaurar",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [queryClient, toast]);

  return {
    transactions,
    isLoading,
    addTransaction,
    updateTransaction,
    updateTransactionSilent,
    deleteTransaction,
    deleteMultipleTransactions,
    updateMultipleTransactions,
    duplicateTransactions,
    deleteAllTransactions,
    undoDelete,
  };
}