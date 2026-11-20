import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { BANKS } from "@/lib/banks";
import { BankLogo } from "@/components/bank-sync/BankLogo";
import type { BankCredential } from "@/hooks/useBankSyncCredentials";

interface BankPickerProps {
  credentials: BankCredential[] | undefined;
  onPick: (bank: string) => void;
}

export function BankPicker({ credentials, onPick }: BankPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2 pt-1">
      {BANKS.map((b) => {
        const isConfigured = credentials?.some((c) => c.bank === b.value);
        return (
          <button
            key={b.value}
            type="button"
            onClick={() => onPick(b.value)}
            className={cn(
              "group relative flex items-center gap-3 p-3 rounded-card",
              "border bg-card transition-all duration-200 cursor-pointer",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            )}
          >
            <BankLogo bank={b} size="sm" />
            <div className="flex-1 text-left min-w-0">
              <span className="text-sm font-medium">{b.label}</span>
              {isConfigured && (
                <p className="text-xs text-success font-medium flex items-center gap-1 mt-0.5">
                  <CalendarClock className="h-2.5 w-2.5" /> Auto-sync activo
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
