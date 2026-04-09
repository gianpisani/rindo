import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTrainingGoals } from "@/hooks/useTrainingGoals";
import { GoalFormModal } from "./GoalFormModal";
import { SPORT_CONFIG } from "@/lib/training-config";
import { Plus, X, Target, CheckCircle2 } from "lucide-react";

const GOAL_LABELS: Record<string, string> = {
  weekly_distance: "km esta semana",
  weekly_duration: "min esta semana",
  weekly_sessions: "sesiones esta semana",
  monthly_distance: "km este mes",
  monthly_duration: "min este mes",
  monthly_sessions: "sesiones este mes",
};

export function TrainingGoals() {
  const { goals, progress, createGoal, deleteGoal, isLoading } = useTrainingGoals();
  const [formOpen, setFormOpen] = useState(false);

  if (isLoading) return null;
  if (goals.length === 0 && !formOpen) {
    return (
      <>
        <button
          onClick={() => setFormOpen(true)}
          className="w-full border border-dashed border-border/30 rounded-2xl py-6 flex flex-col items-center gap-2 text-muted-foreground/40 hover:text-primary hover:border-primary/20 transition-all"
        >
          <Target className="h-5 w-5" />
          <span className="text-xs">Agregar meta de entrenamiento</span>
        </button>
        <GoalFormModal
          open={formOpen}
          onOpenChange={setFormOpen}
          onSave={(data) => createGoal.mutate(data)}
        />
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">
          Metas
        </h4>
        <button
          onClick={() => setFormOpen(true)}
          className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-primary/10 text-muted-foreground/30 hover:text-primary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        {goals.map((goal) => {
          const p = progress[goal.id] || { current: 0, target: goal.target_value, pct: 0 };
          const sportConfig = goal.sport_type ? SPORT_CONFIG[goal.sport_type] : null;
          const SportIcon = sportConfig?.icon;
          const label = GOAL_LABELS[goal.goal_type] || goal.goal_type;
          const isDone = p.pct >= 100;

          const formatValue = (v: number) => {
            if (goal.goal_type.includes("distance")) return `${v.toFixed(1)}`;
            if (goal.goal_type.includes("duration")) {
              return v >= 60 ? `${Math.floor(v / 60)}h ${Math.round(v % 60)}m` : `${Math.round(v)}`;
            }
            return `${Math.round(v)}`;
          };

          return (
            <div
              key={goal.id}
              className={cn(
                "group rounded-2xl border p-3.5 transition-all",
                isDone
                  ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                  : "border-border/40"
              )}
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className={cn(
                  "p-2 rounded-xl shrink-0",
                  isDone ? "bg-emerald-500/10" : sportConfig?.bg || "bg-muted/30"
                )}>
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : SportIcon ? (
                    <SportIcon className={cn("h-4 w-4", sportConfig?.color)} />
                  ) : (
                    <Target className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-muted-foreground/70 truncate">
                      {sportConfig?.label ? `${sportConfig.label} — ` : ""}{label}
                    </span>
                    <button
                      onClick={() => deleteGoal.mutate(goal.id)}
                      className="h-5 w-5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground/30 hover:text-destructive transition-all shrink-0 ml-2"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Progress value */}
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className={cn(
                      "text-base font-bold tabular-nums",
                      isDone && "text-emerald-500"
                    )}>
                      {formatValue(p.current)}
                    </span>
                    <span className="text-xs text-muted-foreground/30 font-medium">
                      / {formatValue(p.target)}
                    </span>
                    <span className={cn(
                      "text-[10px] font-semibold ml-auto tabular-nums",
                      isDone ? "text-emerald-500" : p.pct >= 50 ? "text-amber-500" : "text-muted-foreground/30"
                    )}>
                      {p.pct}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 bg-muted/20 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700 ease-out",
                        isDone
                          ? "bg-emerald-500"
                          : p.pct >= 50
                          ? "bg-amber-500"
                          : sportConfig?.dot || "bg-primary"
                      )}
                      style={{ width: `${Math.min(p.pct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <GoalFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        onSave={(data) => createGoal.mutate(data)}
      />
    </div>
  );
}
