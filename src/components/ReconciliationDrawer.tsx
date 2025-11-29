import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "./ui/drawer";
import { ReconciliationCard } from "./ReconciliationCard";

interface ReconciliationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReconciliationDrawer({ open, onOpenChange }: ReconciliationDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] md:max-w-2xl md:mx-auto">
        <DrawerHeader className="text-left pb-4">
          <DrawerTitle className="text-2xl">Conciliar Balance</DrawerTitle>
          <DrawerDescription className="text-base">
            Verifica que tu balance real coincida con el de la app
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="px-6 pb-8 overflow-auto">
          <ReconciliationCard onSuccess={() => onOpenChange(false)} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

