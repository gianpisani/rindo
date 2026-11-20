import { useState } from "react";
import type { CreditCard, useCreditCards } from "@/hooks/useCreditCards";
import type { InstallmentPurchase, useInstallments } from "@/hooks/useInstallments";

type CardInput = Omit<CreditCard, "id" | "user_id" | "created_at" | "updated_at">;
type InstallmentInput = Omit<
  InstallmentPurchase,
  "id" | "user_id" | "created_at" | "updated_at" | "card_name" | "card_color"
>;
type DeleteTarget = { kind: "card" | "installment"; id: string };

export function useCardEditors(
  cards: ReturnType<typeof useCreditCards>,
  purchases: ReturnType<typeof useInstallments>,
  onCardDeleted: (id: string) => void
) {
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [installmentModalOpen, setInstallmentModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [editingInstallment, setEditingInstallment] = useState<InstallmentPurchase | null>(null);
  const [toDelete, setToDelete] = useState<DeleteTarget | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openNewCard = () => {
    setEditingCard(null);
    setCardModalOpen(true);
  };
  const openEditCard = (id: string) => {
    const full = cards.creditCards.find((c) => c.id === id);
    if (!full) return;
    setEditingCard(full);
    setCardModalOpen(true);
  };
  const openInstallmentModal = (installment: InstallmentPurchase | null) => {
    setEditingInstallment(installment);
    setInstallmentModalOpen(true);
  };
  const askDelete = (kind: DeleteTarget["kind"], id: string) => {
    setToDelete({ kind, id });
    setDeleteOpen(true);
  };

  const onCardModalOpenChange = (open: boolean) => {
    setCardModalOpen(open);
    if (!open) setEditingCard(null);
  };
  const onInstallmentModalOpenChange = (open: boolean) => {
    setInstallmentModalOpen(open);
    if (!open) setEditingInstallment(null);
  };

  const saveCard = async (card: CardInput) => {
    if (editingCard) await cards.updateCreditCard.mutateAsync({ id: editingCard.id, ...card });
    else await cards.addCreditCard.mutateAsync(card);
    setEditingCard(null);
  };

  const saveInstallment = async (purchase: InstallmentInput) => {
    if (editingInstallment) await purchases.updateInstallment.mutateAsync({ id: editingInstallment.id, ...purchase });
    else await purchases.addInstallment.mutateAsync(purchase);
    setEditingInstallment(null);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    if (toDelete.kind === "card") {
      await cards.deleteCreditCard.mutateAsync(toDelete.id);
      onCardDeleted(toDelete.id);
    } else {
      await purchases.deleteInstallment.mutateAsync(toDelete.id);
    }
  };

  return {
    creditCards: cards.creditCards,
    cardModalOpen,
    installmentModalOpen,
    editingCard,
    editingInstallment,
    toDelete,
    deleteOpen,
    setDeleteOpen,
    openNewCard,
    openEditCard,
    openInstallmentModal,
    askDelete,
    onCardModalOpenChange,
    onInstallmentModalOpenChange,
    saveCard,
    saveInstallment,
    confirmDelete,
  };
}

export type CardEditors = ReturnType<typeof useCardEditors>;
