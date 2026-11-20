import { Loader2, RefreshCw, Smartphone } from "lucide-react";
import { SYNC_STATUS_MESSAGES } from "@/lib/bank-sync";

export function BankSyncPolling({ pollStatus }: { pollStatus: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      {pollStatus === "awaiting_2fa" ? (
        <div className="flex flex-col items-center space-y-4">
          <div className="relative flex items-center justify-center h-20 w-20">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse" />
            <Smartphone className="relative z-10 h-12 w-12 text-blue-500" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-xl font-medium">Aprobación requerida</p>
            <p className="text-sm text-muted-foreground">Abre tu app del banco y aprueba la solicitud de acceso</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Esperando aprobación...
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-4">
          <div className="relative flex items-center justify-center h-20 w-20">
            <RefreshCw className="relative z-10 h-12 w-12 text-muted-foreground animate-spin [animation-duration:2s]" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">Conectando con tu banco</p>
            <p className="text-sm text-muted-foreground">{SYNC_STATUS_MESSAGES[pollStatus] ?? "Procesando..."}</p>
          </div>
          <p className="text-xs">Esto puede tardar hasta 90 segundos</p>
        </div>
      )}
    </div>
  );
}
