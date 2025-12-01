import { BaseModal } from "./BaseModal";
import { ReconciliationCard } from "./ReconciliationCard";

interface ReconciliationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReconciliationDrawer({ open, onOpenChange }: ReconciliationDrawerProps) {
  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title="Conciliar Balance"
      description="Verifica que tu balance real coincida con el de la app"
      maxWidth="md"
    >
      <ReconciliationCard onSuccess={() => onOpenChange(false)} />
    </BaseModal>
  );
}

