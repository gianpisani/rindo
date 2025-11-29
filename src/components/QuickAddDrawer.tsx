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
  defaultType?: "Ingreso" | "Gasto" | "Inversión";
}

export function QuickAddDrawer({ open, onOpenChange, defaultType }: QuickAddDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="sm:h-[65vh] h-[90vh] sm:max-w-[85vw] mx-auto">
        <DrawerHeader className="text-left">
          <DrawerTitle className="sm:text-3xl text-xl text-center">Agregar transacción</DrawerTitle>
          <DrawerDescription className="text-center">
            Completa los detalles de tu transacción
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="px-2 pb-6 overflow-auto">
          <QuickTransactionForm 
            onSuccess={() => onOpenChange(false)}
            defaultType={defaultType}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

