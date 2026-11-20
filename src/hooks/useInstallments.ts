import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/integrations/supabase/session";
import { toast } from "sonner";
import { installmentTransactions } from "@/lib/installments";
import { CREDIT_CARDS_KEY } from "./useCreditCards";
import { optimistic } from "./optimistic";

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
  card_name?: string;
  card_color?: string;
}

type InstallmentPatch = Partial<InstallmentPurchase> & { id: string };

type InstallmentInput = Omit<InstallmentPurchase, "id" | "user_id" | "created_at" | "updated_at" | "card_name" | "card_color">;

const INSTALLMENTS_KEY = ["installment_purchases"];

async function insertInstallmentTransactions(purchase: InstallmentPurchase, userId: string) {
  const { error } = await supabase.from("transactions").insert(installmentTransactions(purchase, purchase.id, userId));
  if (error) throw error;
}

async function linkedTransactionIds(installmentId: string) {
  const { data, error } = await supabase.from("transactions").select("id").eq("installment_id", installmentId);
  if (error) throw error;
  return data.map((row) => row.id);
}

async function deleteTransactionsById(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase.from("transactions").delete().in("id", ids);
  if (error) throw error;
}

export function useInstallments() {
  const queryClient = useQueryClient();

  const { data: installments = [], isLoading } = useQuery({
    queryKey: INSTALLMENTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installment_purchases")
        .select("*, credit_cards (name, color)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map((row) => ({
        ...row,
        card_name: row.credit_cards?.name,
        card_color: row.credit_cards?.color,
      })) as InstallmentPurchase[];
    },
  });

  const refreshAffected = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: INSTALLMENTS_KEY }),
    queryClient.invalidateQueries({ queryKey: CREDIT_CARDS_KEY }),
    queryClient.invalidateQueries({ queryKey: ["transactions"] }),
  ]);

  const patchInList = optimistic<InstallmentPurchase[], InstallmentPatch>(queryClient, INSTALLMENTS_KEY, (list, { id, ...changes }) =>
    list.map((purchase) => (purchase.id === id ? { ...purchase, ...changes } : purchase)));

  const removeFromList = optimistic<InstallmentPurchase[], string>(queryClient, INSTALLMENTS_KEY, (list, id) =>
    list.filter((purchase) => purchase.id !== id));

  const addInstallment = useMutation({
    mutationFn: async (purchase: InstallmentInput) => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("installment_purchases")
        .insert({ ...purchase, user_id: userId, paid_installments: purchase.total_installments, is_active: false })
        .select()
        .single();
      if (error) throw error;
      const created = data as InstallmentPurchase;
      try {
        await insertInstallmentTransactions(created, userId);
      } catch (insertError) {
        await supabase.from("installment_purchases").delete().eq("id", created.id);
        throw insertError;
      }
      return created;
    },
    onSuccess: (_, purchase) => toast.success(`${purchase.total_installments} cuotas creadas en Movimientos`),
    onSettled: refreshAffected,
  });

  const updateInstallment = useMutation({
    ...patchInList,
    mutationFn: async ({ id, ...changes }: InstallmentPatch) => {
      const userId = await requireUserId();
      const previousIds = await linkedTransactionIds(id);
      const { data, error } = await supabase
        .from("installment_purchases")
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      await insertInstallmentTransactions(data as InstallmentPurchase, userId);
      await deleteTransactionsById(previousIds);
    },
    onSuccess: () => toast.success("Compra y cuotas actualizadas"),
    onSettled: refreshAffected,
  });

  const deleteInstallment = useMutation({
    ...removeFromList,
    mutationFn: async (id: string) => {
      await deleteTransactionsById(await linkedTransactionIds(id));
      const { error } = await supabase.from("installment_purchases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Compra y cuotas eliminadas"),
    onSettled: refreshAffected,
  });

  return { installments, isLoading, addInstallment, updateInstallment, deleteInstallment };
}
