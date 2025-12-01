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
      <DrawerContent className="md:max-w-2xl md:mx-auto">
        <DrawerHeader className="text-left pb-3 px-6 flex-shrink-0">
          <DrawerTitle className="text-2xl">
            Conciliar Balance
          </DrawerTitle>
          <DrawerDescription className="text-base text-muted-foreground">
            Verifica que tu balance real coincida con el de la app
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-8" style={{ 
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}>
          <ReconciliationCard onSuccess={() => onOpenChange(false)} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

