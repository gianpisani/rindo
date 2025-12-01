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
      <DrawerContent className="sm:max-w-[85vw] mx-auto">
        <DrawerHeader className="text-left pb-2 px-6">
          <DrawerTitle className="sm:text-2xl text-xl text-center">
            Agregar transacción
          </DrawerTitle>
          <DrawerDescription className="text-center text-muted-foreground">
            Completa los detalles de tu transacción
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="px-4 pb-6 overflow-y-auto flex-1" style={{ 
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}>
          <QuickTransactionForm 
            onSuccess={() => onOpenChange(false)}
            defaultType={defaultType}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

