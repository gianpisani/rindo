import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTrainingGoals } from "@/hooks/useTrainingGoals";
import { GoalFormModal } from "./GoalFormModal";
import { SPORT_CONFIG } from "@/lib/training-config";
import { Plus, X, Target } from "lucide-react";

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
      <button
        onClick={() => setFormOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        <Target className="h-3.5 w-3.5" />
        Agregar meta de entrenamiento
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Metas
        </h3>
        <button
          onClick={() => setFormOpen(true)}
          className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
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
                "flex items-center gap-3 px-3 py-2 rounded-lg border border-border/40",
                isDone && "bg-emerald-500/[0.03] border-emerald-500/20"
              )}
            >
              {SportIcon && (
                <SportIcon className={cn("h-4 w-4 shrink-0", sportConfig?.color)} />
              )}
              {!SportIcon && <Target className="h-4 w-4 shrink-0 text-muted-foreground" />}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium truncate">
                    {sportConfig?.label ? `${sportConfig.label}: ` : ""}
                    {formatValue(p.target)} {label}
                  </span>
                  <span className={cn("font-mono tabular-nums shrink-0 ml-2", isDone && "text-emerald-500")}>
                    {formatValue(p.current)}/{formatValue(p.target)}
                  </span>
                </div>
                <Progress value={p.pct} className="h-1.5" />
              </div>

              <button
                onClick={() => deleteGoal.mutate(goal.id)}
                className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
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
