import { queryOptions, useQuery, useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/integrations/supabase/session";
import { toast } from "sonner";
import { useMemo } from "react";
import type { TransactionType } from "@/lib/ledger";
import { byNewest } from "@/lib/tx-order";
import { categorizeSavedTransaction } from "@/integrations/supabase/auto-categorize";
import { ANALYZING_CATEGORY, UNCATEGORIZED, shouldCategorize, withManualCategorySource } from "@/lib/auto-category-policy";
import { groupPatches } from "@/lib/edit-history";
import { MissingRowsError } from "@/lib/errors";
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

const WRITE_SCOPE = { id: "transactions-write" };

const savedRow = ({ isPending: _pending, ...row }: Transaction) => row;

async function persistPatches(patches: TransactionPatch[]) {
  await Promise.all(groupPatches(patches).map(async ({ ids, changes }) => {
    const { data, error } = await supabase.from("transactions").update(withManualCategorySource(changes)).in("id", ids).select("id");
    if (error) throw error;
    if (data.length !== ids.length) throw new MissingRowsError(ids.length - data.length);
  }));
}

export function useTransactions() {
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

  return {
    transactions,
    futureTransactions,
    allTransactions,
    isLoading,
    ...useTransactionWrites(),
  };
}

export function useTransactionWrites() {
  const queryClient = useQueryClient();

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
      const released = await releaseAnalyzingCategory(transaction).then((result) => result, () => null);
      if (released && !released.error && !released.data?.length) toast.dismiss(toastId);
      else toast.warning("Movimiento guardado. No pudimos categorizarlo.", { id: toastId, description: "Puedes elegir una categoría manualmente.", duration: 4500 });
    } finally {
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
    }
  };

  const addTransaction = useMutation({
    mutationKey: ["add-transaction"],
    meta: { handlesOwnError: true },
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

  const applyPatches = optimistic<Transaction[], TransactionPatch[]>(queryClient, TRANSACTIONS_KEY, (list, patches) => {
    const byId = new Map(patches.map(({ id, ...changes }) => [id, changes]));
    return list.map((t) => (byId.has(t.id) ? { ...t, ...byId.get(t.id) } : t));
  });

  const updateTransactions = useMutation({
    scope: WRITE_SCOPE,
    meta: { handlesOwnError: true },
    mutationFn: persistPatches,
    ...applyPatches,
  });

  const deleteTransactions = useMutation({
    scope: WRITE_SCOPE,
    meta: { handlesOwnError: true },
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("transactions").delete().in("id", ids);
      if (error) throw error;
    },
    ...optimistic<Transaction[], string[]>(queryClient, TRANSACTIONS_KEY, (list, ids) =>
      list.filter((t) => !ids.includes(t.id))),
  });

  const restoreTransactions = useMutation({
    scope: WRITE_SCOPE,
    meta: { handlesOwnError: true },
    mutationFn: async (rows: Transaction[]) => {
      const { error } = await supabase.from("transactions").insert(rows.map(savedRow));
      if (error) throw error;
    },
    ...optimistic<Transaction[], Transaction[]>(queryClient, TRANSACTIONS_KEY, (list, rows) =>
      [...rows, ...list.filter((t) => !rows.some((row) => row.id === t.id))].sort(byNewest)),
  });

  const duplicateTransactions = useMutation({
    scope: WRITE_SCOPE,
    meta: { handlesOwnError: true },
    mutationFn: async (ids: string[]) => {
      const userId = await requireUserId();
      const originals = queryClient.getQueryData<Transaction[]>(TRANSACTIONS_KEY) ?? [];
      const copies = originals.filter((t) => ids.includes(t.id)).map((t) => ({
        date: t.date,
        detail: t.detail ? `${t.detail} (copia)` : "(copia)",
        category_name: t.category_name,
        type: t.type,
        amount: t.amount,
        user_id: userId,
      }));
      const { data, error } = await supabase.from("transactions").insert(copies).select();
      if (error) throw error;
      return data as Transaction[];
    },
    onSuccess: (copies) => {
      queryClient.setQueryData<Transaction[]>(TRANSACTIONS_KEY, (previous) => [...copies, ...(previous ?? [])].sort(byNewest));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY }),
  });

  return {
    addTransaction,
    updateTransactions,
    deleteTransactions,
    restoreTransactions,
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
