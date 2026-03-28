import { cn } from "@/lib/utils";
import { SPORT_CONFIG } from "@/lib/training-config";
import { Timer, Flag } from "lucide-react";

interface Props {
  stats: {
    total: number;
    completed: number;
    totalDuration: number;
    sportCounts: Record<string, number>;
    races: number;
  };
}

export function MonthSummaryBanner({ stats }: Props) {
  const completionPct =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="rounded-xl border border-border/50 bg-gradient-to-r from-primary/[0.03] via-card to-card p-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Timer className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Duración
              </p>
              <p className="text-sm font-bold font-mono tabular-nums">
                {Math.floor(stats.totalDuration / 60)}h{" "}
                {stats.totalDuration % 60}m
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Sesiones
            </p>
            <p className="text-sm font-bold font-mono tabular-nums">
              {stats.total}
            </p>
          </div>

          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Completado
            </p>
            <p className="text-sm font-bold font-mono tabular-nums">
              {completionPct}%
            </p>
          </div>

          {stats.races > 0 && (
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-500/10">
                <Flag className="h-3.5 w-3.5 text-rose-500" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Carreras
                </p>
                <p className="text-sm font-bold font-mono tabular-nums">
                  {stats.races}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {Object.entries(stats.sportCounts).map(([sport, count]) => {
            const config = SPORT_CONFIG[sport];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <div
                key={sport}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                  config.bg,
                  config.color
                )}
              >
                <Icon className="h-3 w-3" />
                {count}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
