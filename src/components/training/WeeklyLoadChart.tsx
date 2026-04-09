import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { SPORT_CONFIG } from "@/lib/training-config";
import type { TrainingSession } from "@/hooks/useTrainingSessions";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Flame, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  sessions: TrainingSession[];
  weekStart: Date;
  previousWeekSessions?: TrainingSession[];
}

export function WeeklyLoadChart({ sessions, weekStart, previousWeekSessions }: Props) {
  const { totalMin, sportBreakdown, totalSessions, completedSessions } = useMemo(() => {
    const activeSessions = sessions.filter((s) => s.sport_type !== "rest");

    // Total minutes
    const total = activeSessions.reduce((sum, s) => sum + (s.target_duration_minutes || 0), 0);

    // Sport breakdown
    const sportMap: Record<string, number> = {};
    for (const s of activeSessions) {
      sportMap[s.sport_type] = (sportMap[s.sport_type] || 0) + (s.target_duration_minutes || 0);
    }
    const breakdown = Object.entries(sportMap)
      .sort(([, a], [, b]) => b - a)
      .map(([sport, minutes]) => ({ sport, minutes }));

    return {
      totalMin: total,
      sportBreakdown: breakdown,
      totalSessions: activeSessions.length,
      completedSessions: activeSessions.filter((s) => s.status === "completed").length,
    };
  }, [sessions]);

  const prevMin = useMemo(() => {
    if (!previousWeekSessions) return 0;
    return previousWeekSessions
      .filter((s) => s.sport_type !== "rest")
      .reduce((sum, s) => sum + (s.target_duration_minutes || 0), 0);
  }, [previousWeekSessions]);

  if (sessions.length === 0) return null;

  const totalMax = sportBreakdown.reduce((sum, s) => sum + s.minutes, 0) || 1;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  const diff = prevMin > 0 ? Math.round(((totalMin - prevMin) / prevMin) * 100) : 0;
  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${format(weekStart, "d", { locale: es })} – ${format(weekEnd, "d MMM", { locale: es })}`;

  return (
    <div className="rounded-2xl border border-border/40 p-4 space-y-4">
      {/* Header with date range */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">
            Resumen de la semana
          </h4>
          <p className="text-[11px] text-muted-foreground/35 mt-0.5 capitalize">{weekLabel}</p>
        </div>

        {/* Session count pill */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/30">
          <Flame className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
            {completedSessions}/{totalSessions}
          </span>
        </div>
      </div>

      {/* Big total */}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black tabular-nums tracking-tight">
          {hours > 0 ? `${hours}h` : ""}{hours > 0 && mins > 0 ? " " : ""}{mins > 0 || hours === 0 ? `${mins}m` : ""}
        </span>
        {prevMin > 0 && (
          <span
            className={cn(
              "text-xs font-semibold flex items-center gap-0.5",
              diff > 0 ? "text-emerald-500" : diff < 0 ? "text-rose-400" : "text-muted-foreground/40"
            )}
          >
            {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {diff > 0 ? "+" : ""}{diff}% vs anterior
          </span>
        )}
      </div>

      {/* Stacked bar — all sports in one row */}
      {sportBreakdown.length > 0 && (
        <div className="space-y-2.5">
          {/* Stacked horizontal bar */}
          <div className="h-3 bg-muted/20 rounded-full overflow-hidden flex">
            {sportBreakdown.map(({ sport, minutes }) => {
              const config = SPORT_CONFIG[sport] || SPORT_CONFIG.rest;
              const pct = (minutes / totalMax) * 100;
              return (
                <div
                  key={sport}
                  className={cn("h-full first:rounded-l-full last:rounded-r-full transition-all duration-700 ease-out", config.dot)}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {sportBreakdown.map(({ sport, minutes }) => {
              const config = SPORT_CONFIG[sport] || SPORT_CONFIG.rest;
              const Icon = config.icon;
              const h = Math.floor(minutes / 60);
              const m = minutes % 60;

              return (
                <div key={sport} className="flex items-center gap-1.5">
                  <Icon className={cn("h-3 w-3", config.color)} />
                  <span className="text-[11px] text-muted-foreground/60">
                    {config.label}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-muted-foreground/40">
                    {h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
