import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { TRAINING_PHASES } from "@/lib/training-config";
import type { TrainingSession } from "@/hooks/useTrainingSessions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, parseISO, startOfWeek, isSameWeek } from "date-fns";

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
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Periodización
      </h4>
      <div className="flex gap-0.5 h-3 rounded-full overflow-hidden">
        {weekPhases.map(({ weekKey, phase }) => {
          const config = TRAINING_PHASES[phase];
          if (!config) return null;
          const isCurrent = isSameWeek(parseISO(weekKey), now, { weekStartsOn: 1 });

          return (
            <Tooltip key={weekKey}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex-1 transition-all",
                    config.color,
                    isCurrent && "ring-2 ring-primary ring-offset-1 ring-offset-background rounded-sm"
                  )}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {config.label} — Semana del {weekKey}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="flex gap-3 mt-2 flex-wrap">
        {Array.from(new Set(weekPhases.map((w) => w.phase))).map((phase) => {
          const config = TRAINING_PHASES[phase];
          if (!config) return null;
          return (
            <div key={phase} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <div className={cn("w-2 h-2 rounded-full", config.color)} />
              {config.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
