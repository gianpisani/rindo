import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { addMonths, format } from "date-fns";
import { es } from "date-fns/locale";

export interface InstallmentPurchase {
  id: string;
  user_id: string;
  card_id: string;
  description: string;
  total_amount: number;
  total_installments: number;
  installment_amount: number;
  paid_installments: number;
  purchase_date: string;
  first_installment_date: string;
  category_name: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  card_name?: string;
  card_color?: string;
}

export function useInstallments() {
  const queryClient = useQueryClient();

  // Fetch all installment purchases with card info
  const { data: installments = [], isLoading } = useQuery({
    queryKey: ["installment_purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installment_purchases")
        .select(`
          *,
          credit_cards (
            name,
            color
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map(row => ({
        ...row,
        card_name: row.credit_cards?.name,
        card_color: row.credit_cards?.color,
      })) as InstallmentPurchase[];
    },
  });

  // Add installment purchase AND create all future transactions
  const addInstallment = useMutation({
    mutationFn: async (
      purchase: Omit<InstallmentPurchase, "id" | "user_id" | "created_at" | "updated_at" | "card_name" | "card_color">
    ) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      // 1. Create the installment purchase record
      const { data, error } = await supabase
        .from("installment_purchases")
        .insert({
          ...purchase,
          user_id: userData.user.id,
          paid_installments: purchase.total_installments,
          is_active: false,
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Create ALL transactions linked by installment_id
      const firstDate = new Date(purchase.first_installment_date);
      const transactionsToCreate: TablesInsert<"transactions">[] = [];

      for (let i = 0; i < purchase.total_installments; i++) {
        const installmentDate = addMonths(firstDate, i);
        const monthName = format(installmentDate, "MMMM yyyy", { locale: es });

        transactionsToCreate.push({
          user_id: userData.user.id,
          amount: purchase.installment_amount,
          type: "Gasto",
          category_name: purchase.category_name || "Otros gastos",
          detail: `${purchase.description} - Cuota ${i + 1}/${purchase.total_installments} (${monthName})`,
          card_id: purchase.card_id,
          installment_id: data.id,
          date: installmentDate.toISOString(),
        });
      }

      const { error: txError } = await supabase
        .from("transactions")
        .insert(transactionsToCreate);

      if (txError) {
        console.error("Error creating transactions:", txError);
      }

      return data as InstallmentPurchase;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["installment_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["credit_card_summaries"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(`${variables.total_installments} cuotas creadas en Movimientos`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update installment purchase AND regenerate transactions
  const updateInstallment = useMutation({
    mutationFn: async ({
      id,
      ...purchase
    }: Partial<InstallmentPurchase> & { id: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      // 1. Update the installment record
      const { data, error } = await supabase
        .from("installment_purchases")
        .update({ ...purchase, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // 2. Delete old transactions linked to this installment
      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("installment_id", id);

      if (deleteError) {
        console.error("Error deleting old transactions:", deleteError);
      }

      // 3. Regenerate transactions with updated data
      const updatedPurchase = data as InstallmentPurchase;
      const firstDate = new Date(updatedPurchase.first_installment_date);
      const transactionsToCreate: TablesInsert<"transactions">[] = [];

      for (let i = 0; i < updatedPurchase.total_installments; i++) {
        const installmentDate = addMonths(firstDate, i);
        const monthName = format(installmentDate, "MMMM yyyy", { locale: es });

        transactionsToCreate.push({
          user_id: userData.user.id,
          amount: updatedPurchase.installment_amount,
          type: "Gasto",
          category_name: updatedPurchase.category_name || "Otros gastos",
          detail: `${updatedPurchase.description} - Cuota ${i + 1}/${updatedPurchase.total_installments} (${monthName})`,
          card_id: updatedPurchase.card_id,
          installment_id: id,
          date: installmentDate.toISOString(),
        });
      }

      const { error: txError } = await supabase
        .from("transactions")
        .insert(transactionsToCreate);

      if (txError) {
        console.error("Error recreating transactions:", txError);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installment_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["credit_card_summaries"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Compra y cuotas actualizadas");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete installment purchase and associated transactions
  const deleteInstallment = useMutation({
    mutationFn: async (id: string) => {
      // Delete associated transactions by installment_id (safe, exact match)
      const { error: txError } = await supabase
        .from("transactions")
        .delete()
        .eq("installment_id", id);

      if (txError) {
        console.error("Error deleting associated transactions:", txError);
      }

      const { error } = await supabase.from("installment_purchases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installment_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["credit_card_summaries"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Compra y cuotas eliminadas");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    installments,
    isLoading,
    addInstallment,
    updateInstallment,
    deleteInstallment,
  };
}

/**
 * Cuántas cuotas ya se facturaron (las de fecha pasada), cuántas quedan y
 * cuándo es la última. Una compra sigue activa mientras le quede alguna.
 */
export function installmentProgress(purchase: InstallmentPurchase, today = new Date()) {
  const first = new Date(purchase.first_installment_date);
  const total = purchase.total_installments;
  let billed = 0;
  while (billed < total && addMonths(first, billed) <= today) billed++;
  const last = addMonths(first, total - 1);
  return { billed, left: total - billed, last, active: last >= today };
}
