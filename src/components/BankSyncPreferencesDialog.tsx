import { Mail, RefreshCw, Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BankLogo } from "@/components/BankLogo";
import { getBankById, SYNC_SCHEDULES, isCustomSchedule, getCustomHour } from "@/lib/banks";
import type { SyncScheduleId } from "@/lib/banks";
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
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
                  cred.is_active
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-border/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <RefreshCw
                    className={`h-4 w-4 shrink-0 ${cred.is_active ? "text-green-600 dark:text-green-500" : "text-muted-foreground"}`}
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

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-3">
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
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

              <div className="rounded-xl border border-border/50 p-3 space-y-2">
                <div className="flex items-center gap-2.5">
                  <Settings2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm font-medium">Horario de sync</p>
                </div>
                <div className="flex items-center gap-2 pl-6">
                  <Select
                    value={isCustomSchedule(cred.sync_schedule) ? "custom" : cred.sync_schedule}
                    onValueChange={(v) => {
                      if (v === "custom") {
                        scheduleMutation.mutate({ bank: cred.bank, syncSchedule: "custom_08" as SyncScheduleId });
                      } else {
                        scheduleMutation.mutate({ bank: cred.bank, syncSchedule: v as SyncScheduleId });
                      }
                    }}
                    disabled={!cred.is_active}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-lg flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYNC_SCHEDULES.map((s) => (
                        <SelectItem key={s.value} value={s.value} className="text-xs">
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isCustomSchedule(cred.sync_schedule) && (
                    <Select
                      value={String(getCustomHour(cred.sync_schedule))}
                      onValueChange={(h) =>
                        scheduleMutation.mutate({
                          bank: cred.bank,
                          syncSchedule: `custom_${h.padStart(2, "0")}` as SyncScheduleId,
                        })
                      }
                      disabled={!cred.is_active}
                    >
                      <SelectTrigger className="h-8 text-xs rounded-lg w-20 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={String(i)} className="text-xs">
                            {String(i).padStart(2, "0")}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
