import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
          // Mark all as paid since we're creating transactions
          paid_installments: purchase.total_installments,
          is_active: false, // All transactions created = "paid"
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Create ALL transactions for each installment
      const firstDate = new Date(purchase.first_installment_date);
      const transactionsToCreate = [];

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
          date: installmentDate.toISOString(),
        });
      }

      const { error: txError } = await supabase
        .from("transactions")
        .insert(transactionsToCreate);

      if (txError) {
        console.error("Error creating transactions:", txError);
        // Don't throw - purchase was created
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

  // Update installment purchase
  const updateInstallment = useMutation({
    mutationFn: async ({
      id,
      ...purchase
    }: Partial<InstallmentPurchase> & { id: string }) => {
      const { data, error } = await supabase
        .from("installment_purchases")
        .update({ ...purchase, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installment_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["credit_card_summaries"] });
      toast.success("Compra actualizada");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete installment purchase (also deletes associated transactions)
  const deleteInstallment = useMutation({
    mutationFn: async (id: string) => {
      const purchase = installments.find(i => i.id === id);
      
      // Delete associated transactions by matching detail pattern
      if (purchase) {
        const { error: txError } = await supabase
          .from("transactions")
          .delete()
          .like("detail", `${purchase.description} - Cuota %`);
        
        if (txError) {
          console.error("Error deleting associated transactions:", txError);
        }
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

  // Helper: Get remaining installments for a purchase
  const getRemainingInstallments = (purchase: InstallmentPurchase) => {
    return purchase.total_installments - purchase.paid_installments;
  };

  // Helper: Get remaining amount for a purchase
  const getRemainingAmount = (purchase: InstallmentPurchase) => {
    return getRemainingInstallments(purchase) * purchase.installment_amount;
  };

  // Helper: Get next installment date
  const getNextInstallmentDate = (purchase: InstallmentPurchase) => {
    const firstDate = new Date(purchase.first_installment_date);
    return addMonths(firstDate, purchase.paid_installments);
  };

  // Helper: Generate installment schedule
  const getInstallmentSchedule = (purchase: InstallmentPurchase) => {
    const schedule = [];
    const firstDate = new Date(purchase.first_installment_date);
    const today = new Date();
    
    for (let i = 0; i < purchase.total_installments; i++) {
      const date = addMonths(firstDate, i);
      const isPaid = i < purchase.paid_installments;
      const isPastDue = !isPaid && date <= today;
      const isCurrent = i === purchase.paid_installments && !isPastDue;
      
      schedule.push({
        number: i + 1,
        date,
        dateFormatted: format(date, "MMM yyyy", { locale: es }),
        amount: purchase.installment_amount,
        isPaid,
        isCurrent,
        isPastDue,
      });
    }
    
    return schedule;
  };

  // Totals
  const totals = {
    totalPurchases: installments.length,
    totalAmount: installments.reduce((acc, i) => acc + i.total_amount, 0),
    monthlyPayment: installments.reduce((acc, i) => acc + i.installment_amount, 0),
  };

  return {
    installments,
    isLoading,
    totals,
    addInstallment,
    updateInstallment,
    deleteInstallment,
    // Helpers
    getRemainingInstallments,
    getRemainingAmount,
    getNextInstallmentDate,
    getInstallmentSchedule,
  };
}
