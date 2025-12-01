import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ReconciliationCard } from "./ReconciliationCard";

interface ReconciliationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReconciliationDrawer({ open, onOpenChange }: ReconciliationDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-w-[calc(100vw-2rem)] max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-2xl text-center">
            Conciliar Balance
          </DialogTitle>
          <DialogDescription className="text-center">
            Verifica que tu balance real coincida con el de la app
          </DialogDescription>
        </DialogHeader>
        
        <div className="overflow-y-auto px-6 pb-6">
          <ReconciliationCard onSuccess={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

