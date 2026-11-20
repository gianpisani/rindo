import type { ReactNode } from "react";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { clp } from "@/lib/format";
import type { SyncMovementItem } from "@/contexts/BankSyncContext";

interface SyncMovementRowProps {
  item: SyncMovementItem;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
  dimmed?: boolean;
  meta: ReactNode;
}

export function SyncMovementRow({ item, selectable, selected, onToggle, dimmed = false, meta }: SyncMovementRowProps) {
  const isIncome = item.type === "Ingreso";

  return (
    <div className={cn("flex items-center gap-3 px-3 py-2 text-sm", dimmed && "opacity-40")}>
      {selectable ? (
        <Checkbox checked={selected} onCheckedChange={onToggle} className="shrink-0 cursor-pointer" />
      ) : (
        <div className="w-4 shrink-0" />
      )}
      <div className={cn("flex items-center justify-center w-7 h-7 rounded-full shrink-0", isIncome ? "bg-success/10" : "bg-muted")}>
        {isIncome ? <ArrowDownCircle className="h-4 w-4 text-success" /> : <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-sm">{item.description}</p>
        {meta}
      </div>
      <span className={cn("text-sm font-medium tabular-nums shrink-0", isIncome ? "text-success" : "text-foreground")}>
        {isIncome ? "+" : "-"}{clp(item.amount)}
      </span>
    </div>
  );
}
