import { Mail, RefreshCw, Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { BankLogo } from "@/components/bank-sync/BankLogo";
import { getBankById } from "@/lib/banks";
import { SyncScheduleSelect } from "@/components/bank-sync/SyncScheduleSelect";
import type { BankCredential } from "@/hooks/useBankSyncCredentials";
import {
  useUpdateActive,
  useUpdateNotifyEmail,
  useUpdateSchedule,
} from "@/hooks/useBankSyncCredentials";

interface BankSyncPreferencesDialogProps {
  cred: BankCredential | null;
  onOpenChange: (open: boolean) => void;
}

export function BankSyncPreferencesDialog({ cred, onOpenChange }: BankSyncPreferencesDialogProps) {
  const activeMutation = useUpdateActive();
  const notifyMutation = useUpdateNotifyEmail();
  const scheduleMutation = useUpdateSchedule();

  const bank = cred ? getBankById(cred.bank) : undefined;

  return (
    <Dialog open={!!cred} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="max-w-sm p-6">
        {cred && bank && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <BankLogo bank={bank} size="sm" />
                <div>
                  <DialogTitle>{bank.label}</DialogTitle>
                  <DialogDescription>{cred.rut}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div
                className="flex items-center justify-between gap-3 rounded-card border p-3 transition-colors"
                style={
                  cred.is_active
                    ? { borderColor: `${bank.color}4d`, backgroundColor: `${bank.color}0d` }
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  <RefreshCw
                    className={cred.is_active ? "h-4 w-4 shrink-0" : "h-4 w-4 shrink-0 text-muted-foreground"}
                    style={{ color: cred.is_active ? bank.color : undefined }}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {cred.is_active ? "Auto-sync activo" : "Auto-sync pausado"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cred.is_active
                        ? "Sincroniza automáticamente según el horario"
                        : "No se sincronizará hasta que lo actives"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={cred.is_active}
                  onCheckedChange={(checked) =>
                    activeMutation.mutate({ bank: cred.bank, isActive: checked })
                  }
                />
              </div>

              <div
                className="flex items-center justify-between gap-3 rounded-card border p-3 transition-colors"
                style={
                  cred.notify_email
                    ? { borderColor: `${bank.color}4d`, backgroundColor: `${bank.color}0d` }
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  <Mail
                    className={cred.notify_email ? "h-4 w-4 shrink-0" : "h-4 w-4 shrink-0 text-muted-foreground"}
                    style={{ color: cred.notify_email ? bank.color : undefined }}
                  />
                  <div>
                    <p className="text-sm font-medium">Notificarme por mail</p>
                    <p className="text-xs text-muted-foreground">Recibe un correo al importar movimientos o si falla el sync</p>
                  </div>
                </div>
                <Switch
                  checked={cred.notify_email}
                  onCheckedChange={(checked) =>
                    notifyMutation.mutate({ bank: cred.bank, notifyEmail: checked })
                  }
                />
              </div>

              <div className="rounded-card border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm font-medium">Horario de sync</p>
                </div>
                <div className="flex items-center gap-2 pl-6">
                  <SyncScheduleSelect
                    value={cred.sync_schedule}
                    onChange={(syncSchedule) => scheduleMutation.mutate({ bank: cred.bank, syncSchedule })}
                    disabled={!cred.is_active}
                    includeOff
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
