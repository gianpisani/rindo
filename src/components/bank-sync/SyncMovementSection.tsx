import type { ReactNode } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SyncMovementSectionProps {
  title: string;
  canSelectAll: boolean;
  allSelected: boolean;
  onToggleAll: () => void;
  selectedCount: number;
  busy: boolean;
  actionIcon: LucideIcon;
  actionVerb: string;
  onAction: () => void;
  children: ReactNode;
}

export function SyncMovementSection({
  title,
  canSelectAll,
  allSelected,
  onToggleAll,
  selectedCount,
  busy,
  actionIcon: ActionIcon,
  actionVerb,
  onAction,
  children,
}: SyncMovementSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        {canSelectAll && (
          <button
            type="button"
            onClick={onToggleAll}
            className="text-xs text-foreground hover:underline cursor-pointer"
          >
            {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
          </button>
        )}
      </div>
      <div className="rounded-card border divide-y max-h-[200px] overflow-y-auto">
        {children}
      </div>
      {selectedCount > 0 && (
        <Button onClick={onAction} disabled={busy} className="w-full" variant="ghost">
          {busy ? <Loader2 className="animate-spin" /> : <ActionIcon />}
          {actionVerb} {selectedCount} seleccionada{selectedCount !== 1 ? "s" : ""}
        </Button>
      )}
    </div>
  );
}
