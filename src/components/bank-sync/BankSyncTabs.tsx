import { History, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BankSyncTab } from "@/lib/bank-sync";

const TABS: { id: BankSyncTab; label: string; icon?: React.ElementType }[] = [
  { id: "sync", label: "Sincronizar" },
  { id: "settings", label: "Auto-sync", icon: Settings2 },
  { id: "history", label: "Historial", icon: History },
];

interface BankSyncTabsProps {
  tab: BankSyncTab;
  onSelect: (tab: BankSyncTab) => void;
}

export function BankSyncTabs({ tab, onSelect }: BankSyncTabsProps) {
  return (
    <div className="flex gap-1 p-1 rounded-full mb-4">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer",
            tab === id
              ? "bg-background text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}
