import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SYNC_SCHEDULES, getCustomHour, isCustomSchedule, type SyncScheduleId } from "@/lib/banks";

interface SyncScheduleSelectProps {
  value: SyncScheduleId;
  onChange: (schedule: SyncScheduleId) => void;
  disabled?: boolean;
  includeOff?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function SyncScheduleSelect({ value, onChange, disabled, includeOff = false }: SyncScheduleSelectProps) {
  const schedules = includeOff ? SYNC_SCHEDULES : SYNC_SCHEDULES.filter((s) => s.value !== "disabled");
  return (
    <>
      <Select
        value={isCustomSchedule(value) ? "custom" : value}
        onValueChange={(v) => onChange((v === "custom" ? "custom_08" : v) as SyncScheduleId)}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 text-xs rounded-card flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {schedules.map((s) => (
            <SelectItem key={s.value} value={s.value} className="text-xs">
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isCustomSchedule(value) && (
        <Select
          value={String(getCustomHour(value))}
          onValueChange={(h) => onChange(`custom_${h.padStart(2, "0")}` as SyncScheduleId)}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-xs rounded-card w-20 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((i) => (
              <SelectItem key={i} value={String(i)} className="text-xs">
                {String(i).padStart(2, "0")}:00
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </>
  );
}
