import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import QuickTransactionForm from "./QuickTransactionForm";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@/lib/ledger";

interface QuickAddDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: TransactionType;
}

const typeConfig = {
  Ingreso: { label: "ingreso", prefix: "Nuevo", dot: "bg-success", accent: "text-success" },
  Gasto: { label: "gasto", prefix: "Nuevo", dot: "bg-destructive", accent: "text-destructive" },
  Inversión: { label: "inversión", prefix: "Nueva", dot: "bg-blue-500", accent: "text-blue-500" },
  Rescate: { label: "rescate", prefix: "Nuevo", dot: "bg-cyan-500", accent: "text-cyan-500" },
  Rendimiento: { label: "rendimiento", prefix: "Nuevo", dot: "bg-violet-500", accent: "text-violet-500" },
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
              {config.prefix} {config.label}
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
