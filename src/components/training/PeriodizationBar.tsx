import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { TRAINING_PHASES } from "@/lib/training-config";
import type { TrainingSession } from "@/hooks/useTrainingSessions";
import { format, parseISO, startOfWeek, isSameWeek } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  sessions: TrainingSession[];
}

export function PeriodizationBar({ sessions }: Props) {
  const weekPhases = useMemo(() => {
    const phaseByWeek = new Map<string, string>();
    for (const s of sessions) {
      if (s.training_phase) {
        const weekKey = format(
          startOfWeek(parseISO(s.session_date), { weekStartsOn: 1 }),
          "yyyy-MM-dd"
        );
        phaseByWeek.set(weekKey, s.training_phase);
      }
    }
    return Array.from(phaseByWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekKey, phase]) => ({ weekKey, phase }));
  }, [sessions]);

  if (weekPhases.length === 0) return null;

  const now = new Date();

  return (
    <div className="rounded-2xl border border-border/40 p-4 space-y-3">
      <h4 className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">
        Periodización
      </h4>

      {/* Week blocks */}
      <div className="flex gap-1">
        {weekPhases.map(({ weekKey, phase }) => {
          const config = TRAINING_PHASES[phase];
          if (!config) return null;
          const isCurrent = isSameWeek(parseISO(weekKey), now, { weekStartsOn: 1 });
          const weekLabel = format(parseISO(weekKey), "d MMM", { locale: es });

          return (
            <div key={weekKey} className="flex-1 flex flex-col items-center gap-1.5">
              {/* Bar */}
              <div
                className={cn(
                  "w-full h-3 rounded-full transition-all",
                  config.color,
                  isCurrent && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                )}
              />
              {/* Label */}
              <span className={cn(
                "text-[9px] tabular-nums",
                isCurrent ? "text-primary font-bold" : "text-muted-foreground/40 font-medium"
              )}>
                {weekLabel}
              </span>
              <span className={cn(
                "text-[8px] font-semibold uppercase tracking-wide",
                isCurrent ? "text-foreground/70" : "text-muted-foreground/30"
              )}>
                {config.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
