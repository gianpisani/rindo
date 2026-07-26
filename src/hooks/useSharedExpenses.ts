import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SharedExpense {
  id: string;
  transaction_id: string;
  debtor_name: string;
  amount_owed: number;
  paid: boolean;
  paid_at: string | null;
  paid_transaction_id: string | null;
  user_id: string;
  created_at: string;
}

export interface SharedExpenseWithTransaction extends SharedExpense {
  transaction_date: string;
  transaction_detail: string | null;
  transaction_amount: number;
  transaction_category: string;
}

export interface DebtorSummary {
  debtor_name: string;
  total_owed: number;
  count_expenses: number;
}

export function useSharedExpenses() {
  const queryClient = useQueryClient();

  // Obtener todos los gastos compartidos
  const { data: sharedExpenses = [], isLoading } = useQuery({
    queryKey: ["shared_expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shared_expenses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SharedExpense[];
    },
  });

  // Obtener gastos compartidos de una transacción específica
  const getSharedExpensesByTransaction = (transactionId: string) => {
    return sharedExpenses.filter((se) => se.transaction_id === transactionId);
  };

  // Obtener gastos compartidos con info de transacción
  const { data: sharedExpensesWithTransaction = [] } = useQuery({
    queryKey: ["shared_expenses_with_transaction"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shared_expenses_with_transaction")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SharedExpenseWithTransaction[];
    },
  });

  // Obtener resumen por deudor (solo pendientes)
  const { data: pendingByDebtor = [] } = useQuery({
    queryKey: ["pending_by_debtor"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase.rpc("get_pending_by_debtor", {
        p_user_id: userData.user.id,
      });

      if (error) throw error;
      return (data || []) as DebtorSummary[];
    },
  });

  // Agregar gastos compartidos (batch)
  const addSharedExpenses = useMutation({
    mutationFn: async (expenses: Array<Omit<SharedExpense, "id" | "user_id" | "created_at" | "paid" | "paid_at" | "paid_transaction_id">>) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("shared_expenses")
        .insert(
          expenses.map((exp) => ({
            ...exp,
            user_id: userData.user.id,
          }))
        )
        .select();

      if (error) throw error;
      return data as SharedExpense[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared_expenses"] });
      queryClient.invalidateQueries({ queryKey: ["shared_expenses_with_transaction"] });
      queryClient.invalidateQueries({ queryKey: ["pending_by_debtor"] });
    },
  });

  // Marcar como pagado (crea transacción de ingreso)
  const markAsPaid = useMutation({
    mutationFn: async ({ 
      sharedExpenseId, 
      debtorName, 
      amount,
      transactionDetail,
    }: { 
      sharedExpenseId: string; 
      debtorName: string; 
      amount: number;
      transactionDetail?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      // Construir detalle descriptivo
      const detail = transactionDetail
        ? `${debtorName} pagó: ${transactionDetail}`
        : `Pago de ${debtorName}`;

      // 1. Leer el shared_expense para obtener transaction_id del gasto original
      const { data: sharedExp, error: sharedExpError } = await supabase
        .from("shared_expenses")
        .select("transaction_id")
        .eq("id", sharedExpenseId)
        .single();

      if (sharedExpError) throw sharedExpError;

      // 2. Crear transacción de reembolso (no suma al balance)
      const { data: reembolsoTransaction, error: transactionError } = await supabase
        .from("transactions")
        .insert({
          date: new Date().toISOString(),
          amount,
          type: "Reembolso",
          category_name: "Pagos recibidos",
          detail,
          user_id: userData.user.id,
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // 3. Actualizar shared_expense como pagado
      const { error: updateError } = await supabase
        .from("shared_expenses")
        .update({
          paid: true,
          paid_at: new Date().toISOString(),
          paid_transaction_id: reembolsoTransaction.id,
        })
        .eq("id", sharedExpenseId);

      if (updateError) throw updateError;

      // 4. Reducir el monto del gasto original
      const { data: originalTx, error: originalTxError } = await supabase
        .from("transactions")
        .select("amount")
        .eq("id", sharedExp.transaction_id)
        .single();

      if (!originalTxError && originalTx) {
        const newAmount = Number(originalTx.amount) - amount;
        if (newAmount >= 0) {
          await supabase
            .from("transactions")
            .update({ amount: newAmount })
            .eq("id", sharedExp.transaction_id);
        }
      }

      return reembolsoTransaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared_expenses"] });
      queryClient.invalidateQueries({ queryKey: ["shared_expenses_with_transaction"] });
      queryClient.invalidateQueries({ queryKey: ["pending_by_debtor"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      
      toast.success("Pago registrado. Se ha creado el ingreso automáticamente");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Actualizar monto de un gasto compartido
  const updateSharedExpenseAmount = useMutation({
    mutationFn: async ({ id, amount_owed }: { id: string; amount_owed: number }) => {
      const { error } = await supabase
        .from("shared_expenses")
        .update({ amount_owed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared_expenses"] });
      queryClient.invalidateQueries({ queryKey: ["shared_expenses_with_transaction"] });
      queryClient.invalidateQueries({ queryKey: ["pending_by_debtor"] });
    },
  });

  // Vincular transacción existente como pago de deuda
  const linkExistingTransaction = useMutation({
    mutationFn: async ({
      sharedExpenseId,
      existingTransactionId,
      amount,
      debtorName,
      transactionDetail,
    }: {
      sharedExpenseId: string;
      existingTransactionId: string;
      amount: number;
      debtorName: string;
      transactionDetail?: string;
    }) => {
      // 1. Leer transaction_id del gasto original
      const { data: sharedExp, error: sharedExpError } = await supabase
        .from("shared_expenses")
        .select("transaction_id")
        .eq("id", sharedExpenseId)
        .single();

      if (sharedExpError) throw sharedExpError;

      // 2. Actualizar la transacción vinculada: tipo Reembolso + detalle descriptivo
      const detail = transactionDetail
        ? `${debtorName} pagó: ${transactionDetail}`
        : `Pago de ${debtorName}`;

      await supabase
        .from("transactions")
        .update({ type: "Reembolso", detail, category_name: "Pagos recibidos" })
        .eq("id", existingTransactionId);

      // 3. Marcar como pagado usando la transacción existente
      const { error: updateError } = await supabase
        .from("shared_expenses")
        .update({
          paid: true,
          paid_at: new Date().toISOString(),
          paid_transaction_id: existingTransactionId,
        })
        .eq("id", sharedExpenseId);

      if (updateError) throw updateError;

      // 4. Reducir el monto del gasto original
      const { data: originalTx, error: originalTxError } = await supabase
        .from("transactions")
        .select("amount")
        .eq("id", sharedExp.transaction_id)
        .single();

      if (!originalTxError && originalTx) {
        const newAmount = Number(originalTx.amount) - amount;
        if (newAmount >= 0) {
          await supabase
            .from("transactions")
            .update({ amount: newAmount })
            .eq("id", sharedExp.transaction_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared_expenses"] });
      queryClient.invalidateQueries({ queryKey: ["shared_expenses_with_transaction"] });
      queryClient.invalidateQueries({ queryKey: ["pending_by_debtor"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Deuda vinculada a transacción existente");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Eliminar gasto compartido
  const deleteSharedExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shared_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared_expenses"] });
      queryClient.invalidateQueries({ queryKey: ["shared_expenses_with_transaction"] });
      queryClient.invalidateQueries({ queryKey: ["pending_by_debtor"] });
    },
  });

  // Crear deuda rápida (crea transacción + shared_expense en un paso)
  const addQuickDebt = useMutation({
    mutationFn: async ({
      debtorName,
      amount,
      detail,
    }: {
      debtorName: string;
      amount: number;
      detail?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      // 1. Crear transacción de gasto
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          date: new Date().toISOString(),
          amount,
          type: "Gasto",
          category_name: "Gastos compartidos",
          detail: detail || `Deuda de ${debtorName}`,
          user_id: userData.user.id,
        })
        .select()
        .single();

      if (txError) throw txError;

      // 2. Crear shared_expense vinculado
      const { error: seError } = await supabase
        .from("shared_expenses")
        .insert({
          transaction_id: transaction.id,
          debtor_name: debtorName,
          amount_owed: amount,
          user_id: userData.user.id,
        });

      if (seError) throw seError;

      return transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared_expenses"] });
      queryClient.invalidateQueries({ queryKey: ["shared_expenses_with_transaction"] });
      queryClient.invalidateQueries({ queryKey: ["pending_by_debtor"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Deuda creada");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  return {
    sharedExpenses,
    sharedExpensesWithTransaction,
    pendingByDebtor,
    isLoading,
    addSharedExpenses,
    addQuickDebt,
    updateSharedExpenseAmount,
    markAsPaid,
    linkExistingTransaction,
    deleteSharedExpense,
    getSharedExpensesByTransaction,
  };
}

