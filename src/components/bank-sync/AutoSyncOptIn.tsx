import { CalendarClock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SyncScheduleSelect } from "@/components/bank-sync/SyncScheduleSelect";
import type { SyncScheduleId } from "@/lib/banks";

interface AutoSyncOptInProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  schedule: SyncScheduleId;
  onScheduleChange: (schedule: SyncScheduleId) => void;
}

export function AutoSyncOptIn({ checked, onCheckedChange, schedule, onScheduleChange }: AutoSyncOptInProps) {
  return (
    <div className="rounded-card border p-3 space-y-3 transition-colors">
      <div className="flex items-start gap-3">
        <Checkbox
          id="save-creds"
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(Boolean(v))}
          className="mt-0.5 cursor-pointer"
        />
        <div className="flex-1 min-w-0">
          <Label htmlFor="save-creds" className="text-sm font-medium cursor-pointer">
            Guardar para auto-sync
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Contraseña encriptada. Sincronización automática diaria.
          </p>
        </div>
        <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>

      {checked && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Horario de sincronización</Label>
          <div className="flex gap-2">
            <SyncScheduleSelect value={schedule} onChange={onScheduleChange} />
          </div>
        </div>
      )}
    </div>
  );
}
