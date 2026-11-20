import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SyncResult } from "@/lib/bank-sync";
import type { Bank } from "@/lib/banks";
import type { BankSyncView } from "@/lib/bank-sync";

interface BankSyncFooterProps {
  view: BankSyncView;
  formId: string;
  selectedBank: Bank | undefined;
  submitting: boolean;
  canSubmit: boolean;
  result: SyncResult | null;
  onDismiss: () => void;
  onRetry: () => void;
  onDone: () => void;
}

export function BankSyncFooter({
  view,
  formId,
  selectedBank,
  submitting,
  canSubmit,
  result,
  onDismiss,
  onRetry,
  onDone,
}: BankSyncFooterProps) {
  if (view === "form" && selectedBank) {
    return (
      <div className="flex gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onDismiss}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          form={formId}
          disabled={!canSubmit}
          className="flex-1"
          style={{ backgroundColor: selectedBank.color, borderColor: selectedBank.color }}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Sincronizar
        </Button>
      </div>
    );
  }

  if (view === "polling") {
    return (
      <Button
        variant="ghost"
        onClick={onDismiss}
        className="w-full text-xs font-normal text-muted-foreground"
      >
        Minimizar — sigue corriendo en segundo plano
      </Button>
    );
  }

  if (view === "result" && result && "error" in result) {
    return (
      <div className="flex gap-3">
        <Button
          variant="ghost"
          onClick={onDismiss}
          className="flex-1"
        >
          Cerrar
        </Button>
        <Button onClick={onRetry} className="flex-1">
          Reintentar
        </Button>
      </div>
    );
  }

  if (view === "result" && result) {
    return <Button onClick={onDone} className="w-full">Listo</Button>;
  }

  return null;
}
