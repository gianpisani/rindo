import { BaseModal } from "./BaseModal";
import QuickTransactionForm from "./QuickTransactionForm";

interface QuickAddDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: "Ingreso" | "Gasto" | "Inversión";
}

const typeVariants = {
  "Ingreso": "income",
  "Gasto": "expense",
  "Inversión": "investment",
} as const;

export function QuickAddDrawer({ open, onOpenChange, defaultType = "Gasto" }: QuickAddDrawerProps) {
  const typeText = defaultType === "Ingreso" ? "Ingreso" : defaultType === "Gasto" ? "Gasto" : "Inversión";
  const typeTextLower = typeText.toLowerCase();
  const variant = typeVariants[defaultType];
  
  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Agregar ${typeText}`}
      description={`Completa los detalles de tu ${typeTextLower}`}
      maxWidth="lg"
      variant={variant}
    >
      <QuickTransactionForm 
        onSuccess={() => onOpenChange(false)}
        defaultType={defaultType}
      />
    </BaseModal>
  );
}

