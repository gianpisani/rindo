import { useEffect, useState } from "react";
import { CalendarRange } from "lucide-react";
import { BaseModal } from "@/components/BaseModal";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserProfile } from "@/hooks/useUserProfile";
import { usePeriodConfig } from "@/hooks/usePeriodConfig";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import {
  periodEndDay,
  periodMonthName,
  periodRangeLabel,
  periodStartOf,
  shiftPeriod,
  startDayFromEndDay,
} from "@/lib/period";
import { cn } from "@/lib/utils";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const QUICK = [
  { label: "Calendario", day: 1 },
  { label: "15 → 14", day: 15 },
  { label: "25 → 24", day: 25 },
];

/**
 * El mes financiero: en qué día empieza y en qué día termina el mes que usa
 * toda la analítica. Se abre desde el menú de usuario, la barra de comandos y
 * la fecha del periodo en Finanzas.
 */
export function PeriodSettingsDialog() {
  const open = useGlobalDrawers((s) => s.periodSettingsOpen);
  const setOpen = useGlobalDrawers((s) => s.setPeriodSettingsOpen);
  const { updateProfile } = useUserProfile();
  const { startDay: saved } = usePeriodConfig();
  const [startDay, setStartDay] = useState(saved);

  useEffect(() => {
    if (open) setStartDay(saved);
  }, [open, saved]);

  const endDay = periodEndDay(startDay);
  const current = periodStartOf(new Date(), startDay);
  const preview = [current, shiftPeriod(current, 1, startDay)];

  const save = () => {
    updateProfile.mutate(
      { period_start_day: startDay },
      { onSuccess: () => setOpen(false) }
    );
  };

  return (
    <BaseModal
      open={open}
      onOpenChange={setOpen}
      title="Mes financiero"
      description="Elige en qué día empieza y termina tu mes. Inicio, Finanzas, Meta y los filtros de Movimientos usan este corte."
      maxWidth="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={save}
            disabled={updateProfile.isPending || startDay === saved}
          >
            {updateProfile.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q.day}
              type="button"
              onClick={() => setStartDay(q.day)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                startDay === q.day
                  ? "bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Empieza el día</span>
            <Select value={String(startDay)} onValueChange={(v) => setStartDay(Number(v))}>
              <SelectTrigger aria-label="Día en que empieza el mes">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {DAYS.map((d) => (
                  <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Termina el día</span>
            <Select value={String(endDay)} onValueChange={(v) => setStartDay(startDayFromEndDay(Number(v)))}>
              <SelectTrigger aria-label="Día en que termina el mes">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="0">Último día del mes</SelectItem>
                {DAYS.slice(0, 30).map((d) => (
                  <SelectItem key={d} value={String(d)}>{d} del mes siguiente</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="rounded-xl bg-muted/50 p-3 text-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CalendarRange className="size-3.5" /> Así se verán tus meses
          </div>
          <ul className="space-y-1">
            {preview.map((p) => (
              <li key={p.getTime()} className="flex justify-between gap-3">
                <span className="capitalize">{periodMonthName(p, startDay)}</span>
                <span className="text-muted-foreground">{periodRangeLabel(p, startDay)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          {startDay === 1
            ? "Con el mes calendario, el sueldo y los ahorros que llegan desde el día 25 se cuentan en el mes siguiente."
            : "Cada mes se llama como el mes en que termina. El sueldo y los ahorros se cuentan en el mes en que llegan, según este corte."}
          {startDay > 28 && " En los meses que no tienen ese día, el mes empieza el último día disponible."}
        </p>
      </div>
    </BaseModal>
  );
}
