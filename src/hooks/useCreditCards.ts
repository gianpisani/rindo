import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CreditCard {
  id: string;
  user_id: string;
  name: string;
  credit_limit: number;
  billing_day: number;
  payment_day: number;
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreditCardSummary extends CreditCard {
  used_credit_installments: number;
  used_credit_transactions: number;
  total_used_credit: number;
  available_credit: number;
  next_payment_installments: number;
  active_installment_count: number;
}

export function useCreditCards() {
  const queryClient = useQueryClient();

  // Fetch all credit cards
  const { data: creditCards = [], isLoading } = useQuery({
    queryKey: ["credit_cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_cards")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as CreditCard[];
    },
  });

  // Fetch credit cards with summary (from view)
  const { data: cardSummaries = [], isLoading: isLoadingSummaries } = useQuery({
    queryKey: ["credit_card_summaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_card_summary")
        .select("*")
        .order("card_name");

      if (error) throw error;
      
      // Map view columns to our interface
      return (data || []).map(row => ({
        id: row.card_id,
        user_id: row.user_id,
        name: row.card_name,
        credit_limit: Number(row.credit_limit),
        billing_day: row.billing_day,
        payment_day: row.payment_day,
        color: row.color,
        is_active: row.is_active,
        used_credit_installments: Number(row.used_credit_installments),
        used_credit_transactions: Number(row.used_credit_transactions),
        total_used_credit: Number(row.total_used_credit),
        available_credit: Number(row.available_credit),
        next_payment_installments: Number(row.next_payment_installments),
        active_installment_count: Number(row.active_installment_count),
      })) as CreditCardSummary[];
    },
  });

  // Add credit card
  const addCreditCard = useMutation({
    mutationFn: async (card: Omit<CreditCard, "id" | "user_id" | "created_at" | "updated_at">) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("credit_cards")
        .insert({
          ...card,
          user_id: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CreditCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit_cards"] });
      queryClient.invalidateQueries({ queryKey: ["credit_card_summaries"] });
      toast.success("Tarjeta agregada");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update credit card
  const updateCreditCard = useMutation({
    mutationFn: async ({ id, ...card }: Partial<CreditCard> & { id: string }) => {
      const { data, error } = await supabase
        .from("credit_cards")
        .update({ ...card, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit_cards"] });
      queryClient.invalidateQueries({ queryKey: ["credit_card_summaries"] });
      toast.success("Tarjeta actualizada");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete credit card
  const deleteCreditCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credit_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit_cards"] });
      queryClient.invalidateQueries({ queryKey: ["credit_card_summaries"] });
      toast.success("Tarjeta eliminada");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Calculate totals across all cards
  const totals = cardSummaries.reduce(
    (acc, card) => {
      acc.totalLimit += card.credit_limit;
      acc.totalUsed += card.total_used_credit;
      acc.totalAvailable += card.available_credit;
      acc.totalNextPayment += card.next_payment_installments;
      return acc;
    },
    { totalLimit: 0, totalUsed: 0, totalAvailable: 0, totalNextPayment: 0 }
  );

  return {
    creditCards,
    cardSummaries,
    isLoading: isLoading || isLoadingSummaries,
    totals,
    addCreditCard,
    updateCreditCard,
    deleteCreditCard,
  };
}
