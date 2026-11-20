import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { MonthPace } from "@/lib/month-pace";
import { periodNameDate } from "@/lib/period";
import type { PeriodConfig } from "@/hooks/usePeriodConfig";
import { Button } from "@/components/ui/button";

interface PulseNavProps {
  month: Date;
  startDay: number;
  period: PeriodConfig;
  pace: MonthPace;
  canBack: boolean;
  canForward: boolean;
  onStep: (delta: number) => void;
  onClose: () => void;
}

export function PulseNav({ month, startDay, period, pace, canBack, canForward, onStep, onClose }: PulseNavProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onStep(-1)}
          disabled={!canBack}
          className="size-9 disabled:opacity-30"
          aria-label="Mes anterior"
        >
          <ChevronLeft />
        </Button>
        <div className="min-w-32 text-center">
          <p className="text-sm font-medium capitalize">{format(periodNameDate(month, startDay), "MMMM yyyy", { locale: es })}</p>
          <p className="text-xs text-muted-foreground">
            {!period.isCalendar && <>{period.rangeLabel(month)} · </>}
            {pace.isLive ? `Día ${pace.asOfDay} de ${pace.daysInMonth}` : "Mes cerrado"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onStep(1)}
          disabled={!canForward}
          className="size-9 disabled:opacity-30"
          aria-label="Mes siguiente"
        >
          <ChevronRight />
        </Button>
      </div>
      <Button variant="ghost" size="icon" onClick={onClose} className="size-9 bg-muted" aria-label="Cerrar">
        <X />
      </Button>
    </div>
  );
}
