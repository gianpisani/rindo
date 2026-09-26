import { useQuery, useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCallback, useMemo, useRef } from "react";
import type { TransactionType } from "@/lib/ledger";
import { categorizeSavedTransaction } from "@/lib/ai-categorizer";
import { ANALYZING_CATEGORY, shouldCategorize, withManualCategorySource } from "@/lib/auto-category-policy";

import { useCategories } from "./useCategories";

export interface Transaction {
  category_source?: string | null;
  isPending?: boolean;
  id: string;
  date: string; // Now TIMESTAMPTZ in Chile timezone
  detail: string | null;
  category_name: string;
  type: TransactionType;
  amount: number;
  user_id: string;
  created_at: string;
  card_id: string | null;
  installment_id: string | null;
  reimbursement_for_category: string | null;
  bank_description: string | null;
}

/**
 * Lo que hace falta para crear una transacción: las columnas que el usuario
 * siempre elige, más las opcionales (tarjeta, cuota, tag de reembolso) que
 * cada formulario llena solo si aplican.
 */
export type NewTransaction = Omit<
  Transaction,
  | "id"
  | "user_id"
  | "created_at"
  | "card_id"
  | "installment_id"
  | "reimbursement_for_category"
  | "bank_description"
  | "isPending"
  | "category_source"
> &
  Partial<
    Pick<
      Transaction,
      "card_id" | "installment_id" | "reimbursement_for_category" | "bank_description"
    >
  >;

// Same minute is common (bank syncs, quick entries): creation order breaks the tie.
export const byNewest = (a: Pick<Transaction, "date" | "created_at">, b: Pick<Transaction, "date" | "created_at">) =>
  new Date(b.date).getTime() - new Date(a.date).getTime() ||
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

export function useTransactions() {
  const queryClient = useQueryClient();
  const { hasCategoryContext } = useCategories();
  const lastDeletedRef = useRef<Transaction[]>([]);

  // Fetch ALL transactions (including future)
  const { data: savedTransactions = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      console.log("🔍 Fetching transactions...");
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      console.log("📦 Transactions fetched:", data?.length || 0);
      return data as Transaction[];
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Pending mutations are shared across every mounted view, and disappear on
  // success/error. Refetching cannot erase another save that is still pending.
  const pendingTransactions = useMutationState({
    filters: { mutationKey: ['add-transaction'], status: 'pending' },
    select: mutation => {
      const draft = mutation.state.variables as NewTransaction;
      return {
        card_id: null, installment_id: null, reimbursement_for_category: null, bank_description: null,
        ...draft, id: `pending-${mutation.mutationId}`, user_id: '',
        created_at: new Date(mutation.state.submittedAt).toISOString(), isPending: true,
        category_name: draft.category_name || ANALYZING_CATEGORY,
      } as Transaction;
    },
  });
  const allTransactions = useMemo(() => [...pendingTransactions, ...savedTransactions]
    .sort(byNewest), [savedTransactions, pendingTransactions]);

  // Split into past/present and future transactions
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today
  
  const transactions = allTransactions.filter(t => new Date(t.date) <= today);
  const futureTransactions = allTransactions.filter(t => new Date(t.date) > today);

  const addTransaction = useMutation({
    mutationKey: ['add-transaction'],
    mutationFn: async (transaction: NewTransaction) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("transactions")
        .insert({
          ...withManualCategorySource(transaction, hasCategoryContext),
          category_name: shouldCategorize(transaction) ? ANALYZING_CATEGORY : transaction.category_name || 'Sin categoría',
          user_id: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: (transaction) => {
      queryClient.setQueryData<Transaction[]>(['transactions'], previous =>
        [transaction, ...(previous ?? []).filter(tx => tx.id !== transaction.id)]);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Movimiento guardado", { duration: 1800 });
      if (transaction.category_name !== ANALYZING_CATEGORY) {
        return;
      }
      const toastId = `categorize-${transaction.id}`;
      // Keep saving instant; this one background path serves every creation form.
      void (async () => {
        try {
          const result = await categorizeSavedTransaction(transaction.id);
          if (!result.applied) return;
          queryClient.setQueryData<Transaction[]>(['transactions'], previous => previous?.map(tx =>
            tx.id === transaction.id && tx.category_name === ANALYZING_CATEGORY && tx.detail === transaction.detail && tx.type === transaction.type
              ? { ...tx, category_name: result.category } : tx));
          if (result.decision?.status === 'unavailable' || result.decision?.status === 'skipped') {
            toast.warning("Guardado. No pudimos asignar una categoría.", { id: toastId, description: "Puedes elegirla en el movimiento.", duration: 4500 });
          }
        } catch {
          // Only clear our own pending state; never overwrite a concurrent edit.
          let cleanup = supabase.from('transactions').update({ category_name: 'Sin categoría' })
            .eq('id', transaction.id).eq('user_id', transaction.user_id)
            .eq('category_name', ANALYZING_CATEGORY).eq('type', transaction.type);
          cleanup = transaction.detail === null ? cleanup.is('detail', null) : cleanup.eq('detail', transaction.detail);
          let changedWhileWaiting = false;
          try {
            const { data, error } = await cleanup.select('id');
            changedWhileWaiting = !error && !data?.length;
          } catch { /* A network failure must still settle the loading notification. */ }
          if (changedWhileWaiting) toast.dismiss(toastId);
          else toast.warning("Movimiento guardado. No pudimos categorizarlo.", { id: toastId, description: "Puedes elegir una categoría manualmente.", duration: 4500 });
        } finally {
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
        }
      })();
    },
    onError: (error: Error) => {
      toast.error(error.message, { id: 'transaction-save-error' });
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({
      id,
      ...transaction
    }: Partial<Transaction> & { id: string }) => {
      const { data, error } = await supabase
        .from("transactions")
        .update(withManualCategorySource(transaction, hasCategoryContext))
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
        .update(withManualCategorySource(transaction, hasCategoryContext))
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const toDelete = allTransactions.find(t => t.id === id);
      if (toDelete) lastDeletedRef.current = [toDelete];

      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transacción eliminada", {
        action: {
          label: "Deshacer",
          onClick: () => undoDelete(),
        },
        duration: 8000,
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
      toast.success(`${count} transacciones eliminadas`, {
        action: {
          label: "Deshacer",
          onClick: () => undoDelete(),
        },
        duration: 8000,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
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
        .update(withManualCategorySource(updates, hasCategoryContext))
        .in("id", ids);

      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(`${count} transacciones actualizadas`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
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
      toast.success(`${count} transacciones duplicadas`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
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
      toast.success("Todas las transacciones eliminadas");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Undo last batch delete
  const undoDelete = useCallback(async () => {
    if (lastDeletedRef.current.length === 0) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      // Todo lo que el usuario ve del movimiento, no solo lo básico: si no,
      // deshacer devolvía un reembolso sin su vínculo o una compra sin tarjeta.
      const toRestore = lastDeletedRef.current.map(t => ({
        date: t.date,
        detail: t.detail,
        category_name: t.category_name,
        type: t.type,
        amount: t.amount,
        card_id: t.card_id,
        installment_id: t.installment_id,
        reimbursement_for_category: t.reimbursement_for_category,
        bank_description: t.bank_description,
        ...(hasCategoryContext && t.category_source ? { category_source: t.category_source } : {}),
        user_id: userData.user!.id,
      }));

      const { error } = await supabase
        .from("transactions")
        .insert(toRestore);

      if (error) throw error;

      lastDeletedRef.current = [];
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      
      toast.success(`Se han restaurado ${toRestore.length} transacciones`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(`Error al restaurar transacciones: ${error.message}`);
      } else {
        toast.error("Error al restaurar transacciones: error desconocido");
      }
    }
  }, [queryClient, hasCategoryContext]);

  return {
    transactions,        // Only past/present (for balance, tables by default)
    futureTransactions,  // Future installments (for projections)
    allTransactions,     // Everything (if needed)
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
