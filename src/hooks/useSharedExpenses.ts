import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SharedExpenseDirection = "they_owe_me" | "i_owe_them";

export interface SharedExpense {
  id: string;
  transaction_id: string | null;
  // Nombre de la contraparte: quién me debe (they_owe_me) o a quién le debo (i_owe_them).
  debtor_name: string;
  amount_owed: number;
  paid: boolean;
  paid_at: string | null;
  paid_transaction_id: string | null;
  direction: SharedExpenseDirection;
  // Detalle propio. Solo se usa en deudas "i_owe_them", que no tienen una
  // transacción de la cual heredar transaction_detail.
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

export interface DebtorSummary {
  debtor_name: string;
  total_owed: number;
  count_expenses: number;
}

export interface CreditorSummary {
  creditor_name: string;
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

  // Nombres únicos ya registrados para una dirección (autocomplete)
  const uniqueDebtorNames = (direction: SharedExpenseDirection = "they_owe_me") =>
    [...new Set(sharedExpenses.filter((se) => se.direction === direction).map((se) => se.debtor_name))].sort();

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

  // Obtener resumen por deudor (solo pendientes, dirección "me deben")
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

  // Obtener resumen por acreedor (solo pendientes, dirección "yo debo")
  const { data: pendingByCreditor = [] } = useQuery({
    queryKey: ["pending_by_creditor"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase.rpc("get_pending_by_creditor", {
        p_user_id: userData.user.id,
      });

      if (error) throw error;
      return (data || []) as CreditorSummary[];
    },
  });

  // Agregar gastos compartidos (batch) — siempre dirección "me deben"
  const addSharedExpenses = useMutation({
    mutationFn: async (expenses: Array<Omit<SharedExpense, "id" | "user_id" | "created_at" | "paid" | "paid_at" | "paid_transaction_id" | "direction">>) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("shared_expenses")
        .insert(
          expenses.map((exp) => ({
            ...exp,
            direction: "they_owe_me" as const,
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
      if (sharedExp.transaction_id) {
        const { data: originalTx, error: originalTxError } = await supabase
          .from("transactions")
          .select("amount")
          .eq("id", sharedExp.transaction_id)
          .single();

        if (originalTxError) throw originalTxError;

        if (originalTx) {
          const newAmount = Number(originalTx.amount) - amount;
          if (newAmount >= 0) {
            const { error: reduceError } = await supabase
              .from("transactions")
              .update({ amount: newAmount })
              .eq("id", sharedExp.transaction_id);
            if (reduceError) throw reduceError;
          }
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

  // Vincular transacción existente como pago de deuda (una sola deuda)
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
      if (sharedExp.transaction_id) {
        const { data: originalTx, error: originalTxError } = await supabase
          .from("transactions")
          .select("amount")
          .eq("id", sharedExp.transaction_id)
          .single();

        if (originalTxError) throw originalTxError;

        if (originalTx) {
          const newAmount = Number(originalTx.amount) - amount;
          if (newAmount >= 0) {
            const { error: reduceError } = await supabase
              .from("transactions")
              .update({ amount: newAmount })
              .eq("id", sharedExp.transaction_id);
            if (reduceError) throw reduceError;
          }
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

  // Vincular una transacción existente (Ingreso/Reembolso) como pago de VARIAS
  // deudas a la vez — para cuando un mismo pago salda varias deudas pendientes.
  const linkExistingTransactionToDebts = useMutation({
    mutationFn: async ({
      debts,
      existingTransactionId,
    }: {
      debts: Array<{ sharedExpenseId: string; amount: number; debtorName: string; transactionDetail?: string }>;
      existingTransactionId: string;
    }) => {
      if (debts.length === 0) return;

      // El proyecto compila con strictNullChecks:false, así que un payload mal
      // mapeado (p. ej. pasar {id} en vez de {sharedExpenseId}) no lo detecta el
      // compilador y termina como `IN (undefined)` en Postgres. Falla acá.
      if (debts.some((d) => !d.sharedExpenseId)) {
        throw new Error("linkExistingTransactionToDebts: falta sharedExpenseId en el payload");
      }

      // 1. Detalle combinado con los nombres únicos involucrados
      const uniqueNames = [...new Set(debts.map((d) => d.debtorName))];
      const detail = uniqueNames.length === 1 ? `Pago de ${uniqueNames[0]}` : `Pago de ${uniqueNames.join(", ")}`;

      await supabase
        .from("transactions")
        .update({ type: "Reembolso", detail, category_name: "Pagos recibidos" })
        .eq("id", existingTransactionId);

      // 2. Marcar todas las deudas seleccionadas como pagadas en un solo update
      const ids = debts.map((d) => d.sharedExpenseId);
      const { error: updateError } = await supabase
        .from("shared_expenses")
        .update({
          paid: true,
          paid_at: new Date().toISOString(),
          paid_transaction_id: existingTransactionId,
        })
        .in("id", ids);

      if (updateError) throw updateError;

      // 3. Reducir el monto de cada transacción original afectada, agrupando
      //    por transaction_id (pueden venir de gastos distintos)
      const { data: sharedExpsData } = await supabase
        .from("shared_expenses")
        .select("id, transaction_id")
        .in("id", ids);

      const reduceByOriginalTx = new Map<string, number>();
      for (const d of debts) {
        const se = sharedExpsData?.find((s) => s.id === d.sharedExpenseId);
        if (se?.transaction_id) {
          reduceByOriginalTx.set(se.transaction_id, (reduceByOriginalTx.get(se.transaction_id) || 0) + d.amount);
        }
      }

      for (const [txId, totalReduce] of reduceByOriginalTx) {
        const { data: originalTx, error: originalTxError } = await supabase
          .from("transactions")
          .select("amount")
          .eq("id", txId)
          .single();

        if (!originalTxError && originalTx) {
          const newAmount = Number(originalTx.amount) - totalReduce;
          if (newAmount > 0) {
            await supabase.from("transactions").update({ amount: newAmount }).eq("id", txId);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared_expenses"] });
      queryClient.invalidateQueries({ queryKey: ["shared_expenses_with_transaction"] });
      queryClient.invalidateQueries({ queryKey: ["pending_by_debtor"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Deudas vinculadas a la transacción");
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
      queryClient.invalidateQueries({ queryKey: ["pending_by_creditor"] });
    },
  });

  // Crear deuda rápida "me deben" (crea transacción + shared_expense en un paso)
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
          direction: "they_owe_me",
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

  // Crear deuda manual "yo debo" — sin transacción original, se vincula recién al saldarla
  const addManualDebtIOwe = useMutation({
    mutationFn: async ({
      creditorName,
      amount,
      detail,
    }: {
      creditorName: string;
      amount: number;
      detail?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("shared_expenses")
        .insert({
          transaction_id: null,
          debtor_name: creditorName,
          amount_owed: amount,
          direction: "i_owe_them",
          detail: detail?.trim() || null,
          user_id: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as SharedExpense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared_expenses"] });
      queryClient.invalidateQueries({ queryKey: ["shared_expenses_with_transaction"] });
      queryClient.invalidateQueries({ queryKey: ["pending_by_creditor"] });
      toast.success("Deuda registrada");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Saldar una o varias deudas "yo debo" vinculando un Gasto real ya existente.
  // A diferencia de linkExistingTransactionToDebts, no toca type/category_name
  // de la transacción: sigue siendo un Gasto normal.
  const settleDebtsIOwe = useMutation({
    mutationFn: async ({
      debts,
      existingTransactionId,
    }: {
      debts: Array<{ sharedExpenseId: string }>;
      existingTransactionId: string;
    }) => {
      if (debts.length === 0) return;

      if (debts.some((d) => !d.sharedExpenseId)) {
        throw new Error("settleDebtsIOwe: falta sharedExpenseId en el payload");
      }

      const ids = debts.map((d) => d.sharedExpenseId);
      const { error } = await supabase
        .from("shared_expenses")
        .update({
          paid: true,
          paid_at: new Date().toISOString(),
          paid_transaction_id: existingTransactionId,
        })
        .in("id", ids)
        .eq("direction", "i_owe_them");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared_expenses"] });
      queryClient.invalidateQueries({ queryKey: ["shared_expenses_with_transaction"] });
      queryClient.invalidateQueries({ queryKey: ["pending_by_creditor"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Deuda saldada");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  return {
    sharedExpenses,
    sharedExpensesWithTransaction,
    pendingByDebtor,
    pendingByCreditor,
    isLoading,
    addSharedExpenses,
    addQuickDebt,
    addManualDebtIOwe,
    updateSharedExpenseAmount,
    markAsPaid,
    linkExistingTransaction,
    linkExistingTransactionToDebts,
    settleDebtsIOwe,
    deleteSharedExpense,
    getSharedExpensesByTransaction,
    uniqueDebtorNames,
  };
}
