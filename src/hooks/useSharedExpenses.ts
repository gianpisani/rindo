import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/integrations/supabase/session";
import { toast } from "sonner";
import { optimistic } from "./optimistic";

export type SharedExpenseDirection = "they_owe_me" | "i_owe_them";

export interface SharedExpense {
  id: string;
  transaction_id: string | null;
  debtor_name: string;
  amount_owed: number;
  paid: boolean;
  paid_at: string | null;
  paid_transaction_id: string | null;
  direction: SharedExpenseDirection;
  detail: string | null;
  user_id: string;
  created_at: string;
}

export interface SharedExpenseWithTransaction extends SharedExpense {
  transaction_date: string | null;
  transaction_detail: string | null;
  transaction_amount: number | null;
  transaction_category: string | null;
}

type NewSharedExpense = Pick<SharedExpense, "transaction_id" | "debtor_name" | "amount_owed" | "detail">;
type DebtPayment = { sharedExpenseId: string; amount: number; debtorName: string; transactionDetail?: string };

const SHARED_EXPENSES_KEY = ["shared_expenses"];
const WITH_TRANSACTION_KEY = [...SHARED_EXPENSES_KEY, "with_transaction"];
const PAYMENT_CATEGORY = "Pagos recibidos";

const paymentFrom = (debts: DebtPayment[]) => `Pago de ${[...new Set(debts.map((d) => d.debtorName))].join(", ")}`;

const paymentFor = (debt: DebtPayment) =>
  debt.transactionDetail ? `${debt.debtorName} pagó: ${debt.transactionDetail}` : paymentFrom([debt]);

async function markDebtsPaid(ids: string[], paymentTransactionId: string, direction?: SharedExpenseDirection) {
  let update = supabase
    .from("shared_expenses")
    .update({ paid: true, paid_at: new Date().toISOString(), paid_transaction_id: paymentTransactionId })
    .in("id", ids);
  if (direction) update = update.eq("direction", direction);
  const { error } = await update;
  if (error) throw error;
}

async function reduceOriginalExpenses(debts: DebtPayment[], { keepZero }: { keepZero: boolean }) {
  const { data, error } = await supabase
    .from("shared_expenses")
    .select("id, transaction_id")
    .in("id", debts.map((d) => d.sharedExpenseId));
  if (error) throw error;

  const reductionByTransaction = new Map<string, number>();
  for (const debt of debts) {
    const transactionId = data.find((row) => row.id === debt.sharedExpenseId)?.transaction_id;
    if (transactionId) reductionByTransaction.set(transactionId, (reductionByTransaction.get(transactionId) ?? 0) + debt.amount);
  }

  for (const [transactionId, reduction] of reductionByTransaction) {
    const { data: original, error: readError } = await supabase.from("transactions").select("amount").eq("id", transactionId).single();
    if (readError) throw readError;
    const reducedAmount = Number(original.amount) - reduction;
    if (reducedAmount < 0 || (reducedAmount === 0 && !keepZero)) continue;
    const { error: updateError } = await supabase.from("transactions").update({ amount: reducedAmount }).eq("id", transactionId);
    if (updateError) throw updateError;
  }
}

async function settleTheyOweMe(debts: DebtPayment[], paymentTransactionId: string, { keepZero }: { keepZero: boolean }) {
  await markDebtsPaid(debts.map((d) => d.sharedExpenseId), paymentTransactionId);
  try {
    await reduceOriginalExpenses(debts, { keepZero });
  } catch (error) {
    console.error("No se pudo descontar lo pagado del gasto original", error);
    toast.warning("Deuda saldada, pero no se pudo ajustar el gasto original.", { description: "Revisa su monto en Movimientos." });
  }
}

export function useSharedExpenses() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: SHARED_EXPENSES_KEY });
  const refreshWithTransactions = () => Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["transactions"] })]);

  const { data: sharedExpenses = [], isLoading } = useQuery({
    queryKey: SHARED_EXPENSES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("shared_expenses").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as SharedExpense[];
    },
  });

  const { data: sharedExpensesWithTransaction = [] } = useQuery({
    queryKey: WITH_TRANSACTION_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shared_expenses_with_transaction")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SharedExpenseWithTransaction[];
    },
  });

  const getSharedExpensesByTransaction = (transactionId: string) =>
    sharedExpenses.filter((se) => se.transaction_id === transactionId);

  const uniqueDebtorNames = (direction: SharedExpenseDirection = "they_owe_me") =>
    [...new Set(sharedExpenses.filter((se) => se.direction === direction).map((se) => se.debtor_name))].sort();

  const addSharedExpenses = useMutation({
    mutationFn: async (expenses: NewSharedExpense[]) => {
      const userId = await requireUserId();
      const { error } = await supabase
        .from("shared_expenses")
        .insert(expenses.map((expense) => ({ ...expense, direction: "they_owe_me" as const, user_id: userId })));
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const updateSharedExpenseAmount = useMutation({
    mutationFn: async ({ id, amount_owed }: { id: string; amount_owed: number }) => {
      const { error } = await supabase.from("shared_expenses").update({ amount_owed }).eq("id", id);
      if (error) throw error;
    },
    ...optimistic<SharedExpense[], { id: string; amount_owed: number }>(queryClient, SHARED_EXPENSES_KEY, (list, { id, amount_owed }) =>
      list.map((se) => (se.id === id ? { ...se, amount_owed } : se))),
  });

  const deleteSharedExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shared_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    ...optimistic<SharedExpense[], string>(queryClient, SHARED_EXPENSES_KEY, (list, id) => list.filter((se) => se.id !== id)),
  });

  const markAsPaid = useMutation({
    mutationFn: async (debt: DebtPayment) => {
      const userId = await requireUserId();
      const { data: payment, error } = await supabase
        .from("transactions")
        .insert({
          date: new Date().toISOString(),
          amount: debt.amount,
          type: "Reembolso",
          category_name: PAYMENT_CATEGORY,
          detail: paymentFor(debt),
          user_id: userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      await settleTheyOweMe([debt], payment.id, { keepZero: true });
    },
    onSuccess: () => toast.success("Pago registrado. Se ha creado el ingreso automáticamente"),
    onSettled: refreshWithTransactions,
  });

  const linkExistingTransactionToDebts = useMutation({
    mutationFn: async ({ debts, existingTransactionId }: { debts: DebtPayment[]; existingTransactionId: string }) => {
      if (debts.length === 0) return;
      const { error } = await supabase
        .from("transactions")
        .update({ type: "Reembolso", detail: paymentFrom(debts), category_name: PAYMENT_CATEGORY })
        .eq("id", existingTransactionId);
      if (error) throw error;
      await settleTheyOweMe(debts, existingTransactionId, { keepZero: false });
    },
    onSuccess: () => toast.success("Deudas vinculadas a la transacción"),
    onSettled: refreshWithTransactions,
  });

  const settleDebtsIOwe = useMutation({
    mutationFn: async ({ debts, existingTransactionId }: { debts: Array<{ sharedExpenseId: string }>; existingTransactionId: string }) => {
      if (debts.length === 0) return;
      await markDebtsPaid(debts.map((d) => d.sharedExpenseId), existingTransactionId, "i_owe_them");
    },
    onSuccess: () => toast.success("Deuda saldada"),
    onSettled: refreshWithTransactions,
  });

  return {
    sharedExpenses,
    sharedExpensesWithTransaction,
    isLoading,
    addSharedExpenses,
    updateSharedExpenseAmount,
    markAsPaid,
    linkExistingTransactionToDebts,
    settleDebtsIOwe,
    deleteSharedExpense,
    getSharedExpensesByTransaction,
    uniqueDebtorNames,
  };
}
