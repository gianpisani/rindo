import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { personKey } from "@/lib/debtNetting";

export type SharedExpenseDirection = "they_owe_me" | "i_owe_them";

// Cómo se cerró una deuda: 'cash' se movió plata, 'offset' se compensó contra el
// otro lado y nunca hubo transferencia. Las deudas cerradas antes de que
// existiera la columna quedan en null y se leen como 'cash'.
export type SettlementKind = "cash" | "offset";

export interface SharedExpense {
  id: string;
  transaction_id: string | null;
  // Nombre de la contraparte: quién me debe (they_owe_me) o a quién le debo (i_owe_them).
  debtor_name: string;
  // Versión normalizada de debtor_name (columna generada). Es la identidad por la
  // que se agrupa y se netea; "cata" y "Cata " comparten person_key.
  person_key: string;
  amount_owed: number;
  paid: boolean;
  paid_at: string | null;
  paid_transaction_id: string | null;
  settlement_kind: SettlementKind | null;
  settlement_id: string | null;
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

// Los dos lados de una misma persona en una sola fila. net > 0 me deben,
// net < 0 yo debo, net = 0 estamos al día.
export interface PersonBalance {
  person_key: string;
  display_name: string;
  owed_to_me: number;
  i_owe: number;
  net: number;
  count_owed_to_me: number;
  count_i_owe: number;
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

  // Nombres únicos ya registrados para una dirección (autocomplete). Se deduplica
  // por person_key para no ofrecer "cata" y "Cata" como si fueran dos personas;
  // se muestra la grafía más reciente, igual criterio que get_balances_by_person.
  const uniqueDebtorNames = (direction: SharedExpenseDirection = "they_owe_me") => {
    const byKey = new Map<string, { name: string; createdAt: number }>();

    for (const se of sharedExpenses) {
      if (se.direction !== direction) continue;
      const key = personKey(se.debtor_name);
      const createdAt = new Date(se.created_at).getTime();
      const current = byKey.get(key);
      if (!current || createdAt > current.createdAt) {
        byKey.set(key, { name: se.debtor_name, createdAt });
      }
    }

    return [...byKey.values()].map((v) => v.name).sort((a, b) => a.localeCompare(b, "es"));
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

  // Balance neto por persona: los dos lados juntos. Es lo que consume la página
  // de Deudas; pendingByDebtor/pendingByCreditor quedan sólo por compatibilidad.
  const { data: balancesByPerson = [] } = useQuery({
    queryKey: ["balances_by_person"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase.rpc("get_balances_by_person", {
        p_user_id: userData.user.id,
      });

      if (error) throw error;
      return (data || []) as PersonBalance[];
    },
  });

  // Toda mutación que cierre, cree o borre deudas tiene que refrescar esto.
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["shared_expenses"] });
    queryClient.invalidateQueries({ queryKey: ["shared_expenses_with_transaction"] });
    queryClient.invalidateQueries({ queryKey: ["pending_by_debtor"] });
    queryClient.invalidateQueries({ queryKey: ["pending_by_creditor"] });
    queryClient.invalidateQueries({ queryKey: ["balances_by_person"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  // Cierre de deudas en una sola transacción de base de datos: marca las filas,
  // distingue las compensadas de las pagadas con plata y ajusta el gasto original.
  // Antes esto eran 3-4 escrituras encadenadas desde el cliente, sin atomicidad.
  const settleShared = useMutation({
    mutationFn: async ({
      cashIds,
      offsetIds,
      transactionId,
    }: {
      cashIds: string[];
      offsetIds: string[];
      transactionId?: string | null;
    }) => {
      // El proyecto compila con strictNullChecks:false, así que un payload mal
      // mapeado no lo detecta el compilador y termina como `= ANY(NULL)` en
      // Postgres, cerrando cero filas en silencio. Falla acá.
      const cash = (cashIds || []).filter(Boolean);
      const offset = (offsetIds || []).filter(Boolean);
      if (cash.length + offset.length === 0) {
        throw new Error("settleShared: no se recibió ninguna deuda para saldar");
      }

      const { data, error } = await supabase.rpc("settle_shared_expenses", {
        p_cash_ids: cash,
        p_offset_ids: offset,
        p_transaction_id: transactionId ?? null,
      });

      if (error) throw error;
      return data as string;
    },
    // Sin toast de error: los envoltorios de más abajo y las pantallas que la
    // llaman directo ya reportan, y si no doblaríamos el mensaje.
    onSuccess: invalidateAll,
  });

  // Agregar gastos compartidos (batch) — siempre dirección "me deben"
  const addSharedExpenses = useMutation({
    mutationFn: async (
      expenses: Array<
        Omit<
          SharedExpense,
          | "id"
          | "user_id"
          | "created_at"
          | "paid"
          | "paid_at"
          | "paid_transaction_id"
          | "direction"
          | "person_key"
          | "settlement_kind"
          | "settlement_id"
        >
      >
    ) => {
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
    onSuccess: invalidateAll,
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

      // Crear la transacción de reembolso (no suma al balance)...
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

      // ...y dejar que la RPC cierre la deuda y ajuste el gasto original.
      await settleShared.mutateAsync({
        cashIds: [sharedExpenseId],
        offsetIds: [],
        transactionId: reembolsoTransaction.id,
      });

      return reembolsoTransaction;
    },
    onSuccess: () => {
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
    onSuccess: invalidateAll,
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
      // compilador y llega vacío a Postgres. Falla acá.
      if (debts.some((d) => !d.sharedExpenseId)) {
        throw new Error("linkExistingTransactionToDebts: falta sharedExpenseId en el payload");
      }

      // Reetiquetar la transacción con los nombres involucrados...
      const uniqueNames = [...new Set(debts.map((d) => d.debtorName))];
      const detail = uniqueNames.length === 1 ? `Pago de ${uniqueNames[0]}` : `Pago de ${uniqueNames.join(", ")}`;

      await supabase
        .from("transactions")
        .update({ type: "Reembolso", detail, category_name: "Pagos recibidos" })
        .eq("id", existingTransactionId);

      // ...y cerrar todas las deudas contra ella en una sola operación.
      await settleShared.mutateAsync({
        cashIds: debts.map((d) => d.sharedExpenseId),
        offsetIds: [],
        transactionId: existingTransactionId,
      });
    },
    onSuccess: () => {
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
    onSuccess: invalidateAll,
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
      invalidateAll();
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
      invalidateAll();
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

      await settleShared.mutateAsync({
        cashIds: debts.map((d) => d.sharedExpenseId),
        offsetIds: [],
        transactionId: existingTransactionId,
      });
    },
    onSuccess: () => {
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
    balancesByPerson,
    isLoading,
    addSharedExpenses,
    addQuickDebt,
    addManualDebtIOwe,
    updateSharedExpenseAmount,
    markAsPaid,
    settleShared,
    linkExistingTransactionToDebts,
    settleDebtsIOwe,
    deleteSharedExpense,
    getSharedExpensesByTransaction,
    uniqueDebtorNames,
  };
}
