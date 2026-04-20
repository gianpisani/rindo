import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import QuickTransactionForm from "./QuickTransactionForm";
import { cn } from "@/lib/utils";

interface QuickAddDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: "Ingreso" | "Gasto" | "Inversión" | "Reembolso";
}

const typeConfig = {
  Ingreso: { label: "ingreso", dot: "bg-success", accent: "text-success" },
  Gasto: { label: "gasto", dot: "bg-destructive", accent: "text-destructive" },
  Inversión: { label: "inversión", dot: "bg-blue-500", accent: "text-blue-500" },
} as const;

export function QuickAddDrawer({ open, onOpenChange, defaultType = "Gasto" }: QuickAddDrawerProps) {
  const type = defaultType === "Reembolso" ? "Ingreso" : defaultType;
  const config = typeConfig[type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] w-[92vw] p-0 gap-0 rounded-3xl">
        {/* Minimal header — just a colored dot + type label */}
        <div className="pt-7 pb-1">
          <DialogTitle className="flex items-center justify-center gap-2">
            <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", config.dot)} />
            <span className={cn("text-xs font-semibold uppercase tracking-[0.15em]", config.accent)}>
              Nuevo {config.label}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Registra un nuevo {config.label}
          </DialogDescription>
        </div>

        <div className="px-6 pb-7">
          <QuickTransactionForm
            onSuccess={() => onOpenChange(false)}
            defaultType={defaultType}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
