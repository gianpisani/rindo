import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "./ui/drawer";
import QuickTransactionForm from "./QuickTransactionForm";

interface QuickAddDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickAddDrawer({ open, onOpenChange }: QuickAddDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-xl">Agregar Transacción</DrawerTitle>
          <DrawerDescription>
            Completa los detalles de tu transacción
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="px-6 pb-6 overflow-auto">
          <QuickTransactionForm onSuccess={() => onOpenChange(false)} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

