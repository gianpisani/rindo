import { queryOptions, useQuery, useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/integrations/supabase/session";
import { toast } from "sonner";
import { useMemo, useRef } from "react";
import type { TransactionType } from "@/lib/ledger";
import { byNewest } from "@/lib/tx-order";
import { categorizeSavedTransaction } from "@/lib/ai-categorizer";
import { ANALYZING_CATEGORY, UNCATEGORIZED, shouldCategorize, withManualCategorySource } from "@/lib/auto-category-policy";
import { optimistic } from "./optimistic";

export interface Transaction {
  category_source?: string | null;
  isPending?: boolean;
  id: string;
  date: string;
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

type OptionalColumns = "card_id" | "installment_id" | "reimbursement_for_category" | "bank_description";

export type NewTransaction =
  Omit<Transaction, "id" | "user_id" | "created_at" | "isPending" | "category_source" | OptionalColumns> &
  Partial<Pick<Transaction, OptionalColumns>>;

export type TransactionPatch = Partial<Transaction> & { id: string };

const TRANSACTIONS_KEY = ["transactions"];
const POSTGREST_MAX_ROWS = 1000;

async function fetchAllTransactions() {
  const all: Transaction[] = [];
  for (let from = 0; ; from += POSTGREST_MAX_ROWS) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + POSTGREST_MAX_ROWS - 1);
    if (error) throw error;
    all.push(...(data as Transaction[]));
    if (data.length < POSTGREST_MAX_ROWS) return all;
  }
}

export const transactionsQuery = queryOptions({
  queryKey: TRANSACTIONS_KEY,
  queryFn: fetchAllTransactions,
  refetchOnWindowFocus: true,
  staleTime: 0,
});

const endOfToday = () => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
};

const restorable = (t: Transaction, userId: string) => ({
  date: t.date,
  detail: t.detail,
  category_name: t.category_name,
  type: t.type,
  amount: t.amount,
  card_id: t.card_id,
  installment_id: t.installment_id,
  reimbursement_for_category: t.reimbursement_for_category,
  bank_description: t.bank_description,
  category_source: t.category_source ?? null,
  user_id: userId,
});

const plural = (count: number, one: string, many: string) => (count === 1 ? one : `${count} ${many}`);

export function useTransactions() {
  const queryClient = useQueryClient();
  const lastDeletedRef = useRef<Transaction[]>([]);

  const { data: savedTransactions = [], isLoading } = useQuery(transactionsQuery);

  const pendingTransactions = useMutationState({
    filters: { mutationKey: ["add-transaction"], status: "pending" },
    select: (mutation) => {
      const draft = mutation.state.variables as NewTransaction;
      return {
        card_id: null, installment_id: null, reimbursement_for_category: null, bank_description: null,
        ...draft, id: `pending-${mutation.mutationId}`, user_id: "",
        created_at: new Date(mutation.state.submittedAt).toISOString(), isPending: true,
        category_name: draft.category_name || ANALYZING_CATEGORY,
      } as Transaction;
    },
  });

  const allTransactions = useMemo(
    () => [...pendingTransactions, ...savedTransactions].sort(byNewest),
    [savedTransactions, pendingTransactions],
  );
  const today = endOfToday();
  const transactions = allTransactions.filter((t) => new Date(t.date) <= today);
  const futureTransactions = allTransactions.filter((t) => new Date(t.date) > today);

  const patchList = (list: Transaction[], ids: string[], changes: Partial<Transaction>) =>
    list.map((t) => (ids.includes(t.id) ? { ...t, ...changes } : t));

  const categorizeInBackground = async (transaction: Transaction) => {
    const toastId = `categorize-${transaction.id}`;
    try {
      const result = await categorizeSavedTransaction(transaction.id);
      if (!result.applied) return;
      queryClient.setQueryData<Transaction[]>(TRANSACTIONS_KEY, (previous) => previous?.map((tx) =>
        tx.id === transaction.id && tx.category_name === ANALYZING_CATEGORY && tx.detail === transaction.detail && tx.type === transaction.type
          ? { ...tx, category_name: result.category } : tx));
      if (result.decision?.status === "unavailable" || result.decision?.status === "skipped") {
        toast.warning("Guardado. No pudimos asignar una categoría.", { id: toastId, description: "Puedes elegirla en el movimiento.", duration: 4500 });
      }
    } catch {
      const { data, error } = await releaseAnalyzingCategory(transaction);
      if (!error && !data?.length) toast.dismiss(toastId);
      else toast.warning("Movimiento guardado. No pudimos categorizarlo.", { id: toastId, description: "Puedes elegir una categoría manualmente.", duration: 4500 });
    } finally {
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
    }
  };

  const addTransaction = useMutation({
    mutationKey: ["add-transaction"],
    mutationFn: async (transaction: NewTransaction) => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          ...withManualCategorySource(transaction),
          category_name: shouldCategorize(transaction) ? ANALYZING_CATEGORY : transaction.category_name || UNCATEGORIZED,
          user_id: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Transaction;
    },
    onSuccess: (transaction) => {
      queryClient.setQueryData<Transaction[]>(TRANSACTIONS_KEY, (previous) =>
        [transaction, ...(previous ?? []).filter((tx) => tx.id !== transaction.id)]);
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
      toast.success("Movimiento guardado", { duration: 1800 });
      if (transaction.category_name === ANALYZING_CATEGORY) void categorizeInBackground(transaction);
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...changes }: TransactionPatch) => {
      const { error } = await supabase.from("transactions").update(withManualCategorySource(changes)).eq("id", id);
      if (error) throw error;
    },
    ...optimistic<Transaction[], TransactionPatch>(queryClient, TRANSACTIONS_KEY, (list, { id, ...changes }) =>
      patchList(list, [id], changes)),
  });

  const updateMultipleTransactions = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<Pick<Transaction, "category_name" | "type">> }) => {
      const { error } = await supabase.from("transactions").update(withManualCategorySource(updates)).in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    ...optimistic<Transaction[], { ids: string[]; updates: Partial<Transaction> }>(queryClient, TRANSACTIONS_KEY, (list, { ids, updates }) =>
      patchList(list, ids, updates)),
    onSuccess: (count) => toast.success(`${plural(count, "Movimiento actualizado", "movimientos actualizados")}`),
  });

  const restoreDeleted = useMutation({
    mutationFn: async () => {
      const userId = await requireUserId();
      const rows = lastDeletedRef.current.map((t) => restorable(t, userId));
      const { error } = await supabase.from("transactions").insert(rows);
      if (error) throw error;
      lastDeletedRef.current = [];
      return rows.length;
    },
    onSuccess: (count) => toast.success(plural(count, "Movimiento restaurado", "movimientos restaurados")),
    onSettled: () => queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY }),
  });

  const removeFromList = optimistic<Transaction[], string[]>(queryClient, TRANSACTIONS_KEY, (list, ids) =>
    list.filter((t) => !ids.includes(t.id)));

  const deleteTransactions = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("transactions").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    ...removeFromList,
    onMutate: async (ids: string[]) => {
      const snapshot = await removeFromList.onMutate(ids);
      lastDeletedRef.current = (snapshot.previous ?? []).filter((t) => ids.includes(t.id));
      return snapshot;
    },
    onSuccess: (count) => {
      toast.success(plural(count, "Movimiento eliminado", "movimientos eliminados"), {
        action: { label: "Deshacer", onClick: () => restoreDeleted.mutate() },
        duration: 8000,
      });
    },
  });

  const duplicateTransactions = useMutation({
    mutationFn: async (ids: string[]) => {
      const userId = await requireUserId();
      const copies = allTransactions.filter((t) => ids.includes(t.id)).map((t) => ({
        date: t.date,
        detail: t.detail ? `${t.detail} (copia)` : "(copia)",
        category_name: t.category_name,
        type: t.type,
        amount: t.amount,
        user_id: userId,
      }));
      const { error } = await supabase.from("transactions").insert(copies);
      if (error) throw error;
      return copies.length;
    },
    onSuccess: (count) => toast.success(plural(count, "Movimiento duplicado", "movimientos duplicados")),
    onSettled: () => queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY }),
  });

  return {
    transactions,
    futureTransactions,
    allTransactions,
    isLoading,
    addTransaction,
    updateTransaction,
    updateMultipleTransactions,
    deleteTransactions,
    duplicateTransactions,
  };
}

function releaseAnalyzingCategory(transaction: Transaction) {
  const stillAnalyzing = supabase.from("transactions").update({ category_name: UNCATEGORIZED })
    .eq("id", transaction.id).eq("user_id", transaction.user_id)
    .eq("category_name", ANALYZING_CATEGORY).eq("type", transaction.type);
  const sameDetail = transaction.detail === null ? stillAnalyzing.is("detail", null) : stillAnalyzing.eq("detail", transaction.detail);
  return sameDetail.select("id");
}
