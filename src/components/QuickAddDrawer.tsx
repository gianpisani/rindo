import { BaseModal } from "./BaseModal";
import QuickTransactionForm from "./QuickTransactionForm";

interface QuickAddDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: "Ingreso" | "Gasto" | "Inversión";
}

export function QuickAddDrawer({ open, onOpenChange, defaultType }: QuickAddDrawerProps) {
  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title="Agregar transacción"
      description="Completa los detalles de tu transacción"
      maxWidth="lg"
    >
      <QuickTransactionForm 
        onSuccess={() => onOpenChange(false)}
        defaultType={defaultType}
      />
    </BaseModal>
  );
}

