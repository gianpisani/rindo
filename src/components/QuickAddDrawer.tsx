import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import QuickTransactionForm from "./QuickTransactionForm";

interface QuickAddDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: "Ingreso" | "Gasto" | "Inversión";
}

export function QuickAddDrawer({ open, onOpenChange, defaultType }: QuickAddDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-w-[calc(100vw-2rem)] max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-2xl text-center">
            Agregar transacción
          </DialogTitle>
          <DialogDescription className="text-center">
            Completa los detalles de tu transacción
          </DialogDescription>
        </DialogHeader>
        
        <div className="overflow-y-auto px-6 pb-6">
          <QuickTransactionForm 
            onSuccess={() => onOpenChange(false)}
            defaultType={defaultType}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

