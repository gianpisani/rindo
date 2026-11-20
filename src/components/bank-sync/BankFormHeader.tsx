import { CheckCircle2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BankLogo } from "@/components/bank-sync/BankLogo";
import type { Bank } from "@/lib/banks";

interface BankFormHeaderProps {
  bank: Bank;
  hasStoredCredentials: boolean;
  onBack: () => void;
}

export function BankFormHeader({ bank, hasStoredCredentials, onBack }: BankFormHeaderProps) {
  return (
    <div
      className="relative flex items-center gap-4 p-4 rounded-card overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${bank.color}18 0%, ${bank.color}08 100%)` }}
    >
      <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full blur-2xl opacity-30" style={{ backgroundColor: bank.color }} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="relative z-10 size-9 shrink-0 backdrop-blur-sm hover:bg-background"
        aria-label="Elegir otro banco"
      >
        <ChevronLeft className="text-muted-foreground" />
      </Button>
      <div className="relative z-10">
        <BankLogo bank={bank} size="md" />
      </div>
      <div className="relative z-10 flex-1 min-w-0">
        <p className="font-medium text-sm">{bank.label}</p>
        <p className="text-xs text-muted-foreground">
          {hasStoredCredentials ? "Auto-sync configurado · Credenciales guardadas" : "Conexión segura · Encriptación de extremo a extremo"}
        </p>
      </div>
      {hasStoredCredentials && (
        <div className="relative z-10 flex items-center justify-center w-7 h-7 rounded-full shrink-0">
          <CheckCircle2 className="h-4 w-4 text-foreground" />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${bank.color}60, ${bank.color}10)` }} />
    </div>
  );
}
