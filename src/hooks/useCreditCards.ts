import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/integrations/supabase/session";
import { toast } from "sonner";
import { optimistic } from "./optimistic";

export interface CreditCard {
  id: string;
  user_id: string;
  name: string;
  credit_limit: number;
  billing_day: number;
  payment_day: number;
  color: string | null;
  last_4_digits: string | null;
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

export const CREDIT_CARDS_KEY = ["credit_cards"];
const SUMMARIES_KEY = [...CREDIT_CARDS_KEY, "summaries"];

type CardInput = Omit<CreditCard, "id" | "user_id" | "created_at" | "updated_at">;
type CardPatch = Partial<CreditCard> & { id: string };

async function fetchCards() {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("credit_cards").select("*").eq("user_id", userId).order("name");
  if (error) throw error;
  return data as CreditCard[];
}

async function fetchSummaries() {
  const userId = await requireUserId();
  const { data, error } = await supabase.from("credit_card_summary").select("*").eq("user_id", userId).order("card_name");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.card_id,
    user_id: row.user_id,
    name: row.card_name,
    credit_limit: Number(row.credit_limit),
    billing_day: row.billing_day,
    payment_day: row.payment_day,
    color: row.color,
    last_4_digits: row.last_4_digits ?? null,
    is_active: row.is_active,
    used_credit_installments: Number(row.used_credit_installments),
    used_credit_transactions: Number(row.used_credit_transactions),
    total_used_credit: Number(row.total_used_credit),
    available_credit: Number(row.available_credit),
    next_payment_installments: Number(row.next_payment_installments),
    active_installment_count: Number(row.active_installment_count),
  })) as CreditCardSummary[];
}

export function useCreditCards() {
  const queryClient = useQueryClient();
  const { data: creditCards = [], isLoading } = useQuery({ queryKey: CREDIT_CARDS_KEY, queryFn: fetchCards });
  const { data: cardSummaries = [], isLoading: isLoadingSummaries } = useQuery({ queryKey: SUMMARIES_KEY, queryFn: fetchSummaries });

  const addCreditCard = useMutation({
    mutationFn: async (card: CardInput) => {
      const userId = await requireUserId();
      const { data, error } = await supabase.from("credit_cards").insert({ ...card, user_id: userId }).select().single();
      if (error) throw error;
      return data as CreditCard;
    },
    onSuccess: () => toast.success("Tarjeta agregada"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CREDIT_CARDS_KEY }),
  });

  const updateCreditCard = useMutation({
    mutationFn: async ({ id, ...changes }: CardPatch) => {
      const { error } = await supabase
        .from("credit_cards")
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    ...optimistic<CreditCard[], CardPatch>(queryClient, CREDIT_CARDS_KEY, (list, { id, ...changes }) =>
      list.map((card) => (card.id === id ? { ...card, ...changes } : card))),
    onSuccess: () => toast.success("Tarjeta actualizada"),
  });

  const deleteCreditCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credit_cards").delete().eq("id", id);
      if (error) throw error;
    },
    ...optimistic<CreditCard[], string>(queryClient, CREDIT_CARDS_KEY, (list, id) => list.filter((card) => card.id !== id)),
    onSuccess: () => toast.success("Tarjeta eliminada"),
  });

  return {
    creditCards,
    cardSummaries,
    isLoading: isLoading || isLoadingSummaries,
    addCreditCard,
    updateCreditCard,
    deleteCreditCard,
  };
}
