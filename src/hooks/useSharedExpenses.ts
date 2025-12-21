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

      // 1. Crear transacción de ingreso
      const { data: ingresoTransaction, error: transactionError } = await supabase
        .from("transactions")
        .insert({
          date: new Date().toISOString(),
          amount,
          type: "Ingreso",
          category_name: "Pagos recibidos",
          detail,
          user_id: userData.user.id,
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // 2. Actualizar shared_expense como pagado
      const { error: updateError } = await supabase
        .from("shared_expenses")
        .update({
          paid: true,
          paid_at: new Date().toISOString(),
          paid_transaction_id: ingresoTransaction.id,
        })
        .eq("id", sharedExpenseId);

      if (updateError) throw updateError;

      return ingresoTransaction;
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

  return {
    sharedExpenses,
    sharedExpensesWithTransaction,
    pendingByDebtor,
    isLoading,
    addSharedExpenses,
    markAsPaid,
    deleteSharedExpense,
    getSharedExpensesByTransaction,
  };
}

