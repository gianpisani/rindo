import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { SPORT_CONFIG, TRAINING_PHASES } from "@/lib/training-config";
import type { TrainingSession } from "@/hooks/useTrainingSessions";
import { format, parseISO, startOfWeek, isSameWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Timer, Flame, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  sessions: TrainingSession[];
}

export function WeeklyLoadChart({ sessions }: Props) {
  const { currentWeek, previousWeek, sportBreakdown, currentPhase, totalSessions, completedSessions } =
    useMemo(() => {
      const now = new Date();
      const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });

      // Group by week
      const weekMap = new Map<string, TrainingSession[]>();
      for (const s of sessions) {
        const weekKey = format(
          startOfWeek(parseISO(s.session_date), { weekStartsOn: 1 }),
          "yyyy-MM-dd"
        );
        if (!weekMap.has(weekKey)) weekMap.set(weekKey, []);
        weekMap.get(weekKey)!.push(s);
      }

      // Current week stats
      const thisWeekKey = format(thisWeekStart, "yyyy-MM-dd");
      const thisWeekSessions = weekMap.get(thisWeekKey) || [];
      const currentMin = thisWeekSessions
        .filter((s) => s.sport_type !== "rest")
        .reduce((sum, s) => sum + (s.target_duration_minutes || 0), 0);

      // Previous week (find the week before current)
      const sortedWeeks = Array.from(weekMap.keys()).sort();
      const currentIdx = sortedWeeks.indexOf(thisWeekKey);
      const prevWeekKey = currentIdx > 0 ? sortedWeeks[currentIdx - 1] : null;
      const prevWeekSessions = prevWeekKey ? weekMap.get(prevWeekKey) || [] : [];
      const prevMin = prevWeekSessions
        .filter((s) => s.sport_type !== "rest")
        .reduce((sum, s) => sum + (s.target_duration_minutes || 0), 0);

      // Sport breakdown for current week
      const sportMap: Record<string, number> = {};
      for (const s of thisWeekSessions) {
        if (s.sport_type === "rest") continue;
        sportMap[s.sport_type] = (sportMap[s.sport_type] || 0) + (s.target_duration_minutes || 0);
      }
      const breakdown = Object.entries(sportMap)
        .sort(([, a], [, b]) => b - a)
        .map(([sport, minutes]) => ({ sport, minutes }));

      // Current phase
      const phase = thisWeekSessions.find((s) => s.training_phase)?.training_phase || null;

      // Session counts
      const total = thisWeekSessions.filter((s) => s.sport_type !== "rest").length;
      const completed = thisWeekSessions.filter(
        (s) => s.sport_type !== "rest" && s.status === "completed"
      ).length;

      return {
        currentWeek: currentMin,
        previousWeek: prevMin,
        sportBreakdown: breakdown,
        currentPhase: phase,
        totalSessions: total,
        completedSessions: completed,
      };
    }, [sessions]);

  if (sessions.length === 0) return null;

  const maxMinutes = Math.max(...sportBreakdown.map((s) => s.minutes), 1);
  const hours = Math.floor(currentWeek / 60);
  const mins = currentWeek % 60;
  const diff = previousWeek > 0 ? Math.round(((currentWeek - previousWeek) / previousWeek) * 100) : 0;
  const phaseConfig = currentPhase ? TRAINING_PHASES[currentPhase] : null;

  return (
    <div className="rounded-2xl border border-border/40 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">
            Volumen semanal
          </h4>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black tabular-nums tracking-tight">
              {hours > 0 ? `${hours}h` : ""}{hours > 0 && mins > 0 ? " " : ""}{mins > 0 || hours === 0 ? `${mins}m` : ""}
            </span>
            {previousWeek > 0 && (
              <span
                className={cn(
                  "text-xs font-semibold flex items-center gap-0.5",
                  diff > 0 ? "text-emerald-500" : diff < 0 ? "text-rose-400" : "text-muted-foreground/40"
                )}
              >
                {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {diff > 0 ? "+" : ""}{diff}%
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Phase badge */}
          {phaseConfig && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/30">
              <div className={cn("w-2 h-2 rounded-full", phaseConfig.color)} />
              <span className="text-[10px] font-semibold text-muted-foreground">
                {phaseConfig.label}
              </span>
            </div>
          )}

          {/* Session count */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/30">
            <Flame className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
              {completedSessions}/{totalSessions}
            </span>
          </div>
        </div>
      </div>

      {/* Sport breakdown bars */}
      {sportBreakdown.length > 0 && (
        <div className="space-y-2">
          {sportBreakdown.map(({ sport, minutes }) => {
            const config = SPORT_CONFIG[sport] || SPORT_CONFIG.rest;
            const Icon = config.icon;
            const pct = (minutes / maxMinutes) * 100;
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;

            return (
              <div key={sport} className="flex items-center gap-2.5">
                <div className={cn("p-1 rounded-md shrink-0", config.bg)}>
                  <Icon className={cn("h-3 w-3", config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-muted-foreground/70">
                      {config.label}
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-muted-foreground/50">
                      {h > 0 ? `${h}h ${m}m` : `${m}m`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700 ease-out", config.dot)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
