import { CreditCardModal } from "@/components/credit-cards/CreditCardModal";
import { InstallmentModal } from "@/components/credit-cards/InstallmentModal";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import type { CardEditors } from "@/hooks/useCardEditors";

export function CardEditorDialogs({ editors }: { editors: CardEditors }) {
  const isCard = editors.toDelete?.kind === "card";
  return (
    <>
      <CreditCardModal
        open={editors.cardModalOpen}
        onOpenChange={editors.onCardModalOpenChange}
        card={editors.editingCard}
        onSave={editors.saveCard}
      />

      <InstallmentModal
        open={editors.installmentModalOpen}
        onOpenChange={editors.onInstallmentModalOpenChange}
        installment={editors.editingInstallment}
        creditCards={editors.creditCards}
        onSave={editors.saveInstallment}
      />

      <ConfirmDialog
        open={editors.deleteOpen}
        onOpenChange={editors.setDeleteOpen}
        title={isCard ? "¿Eliminar tarjeta?" : "¿Eliminar compra?"}
        description={
          isCard
            ? "Se eliminarán también todas las compras en cuotas asociadas. Esta acción no se puede deshacer."
            : "Se eliminará el registro y todas las cuotas en Movimientos. Esta acción no se puede deshacer."
        }
        confirmText="Eliminar"
        onConfirm={editors.confirmDelete}
      />
    </>
  );
}
