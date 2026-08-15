import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { differenceInCalendarDays, format } from "date-fns";
import { cn } from "@/lib/utils";
import { X, Languages } from "lucide-react";
import { useLearningGoals } from "@/hooks/useLearningGoals";
import { useLastLearningSession } from "@/hooks/useLearningSessions";

/** Días sin sesión antes de asomar el recordatorio. */
const NUDGE_AFTER_DAYS = 3;

const dismissKey = () => `rindo:learning-nudge:${format(new Date(), "yyyy-MM-dd")}`;

/**
 * Recordatorio en el inicio cuando llevas varios días sin una sesión.
 *
 * No hace falta ninguna lista de usuarios: solo aparece si existe un objetivo
 * de aprendizaje activo y ya hay al menos una sesión terminada. Quien no use
 * la sección nunca ve nada.
 */
export function LearningNudge() {
  const navigate = useNavigate();
  const { activeGoals } = useLearningGoals();
  const { data: lastSession } = useLastLearningSession();

  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(dismissKey()) === "1"
  );

  const goal = activeGoals[0];
  if (!goal || !lastSession || dismissed) return null;

  const daysSince = differenceInCalendarDays(
    new Date(),
    new Date(lastSession.started_at)
  );
  if (daysSince < NUDGE_AFTER_DAYS) return null;

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem(dismissKey(), "1");
    setDismissed(true);
  };

  return (
    <div className="relative">
      <button
        onClick={() => navigate("/learning")}
        className={cn(
          "w-full text-left rounded-xl border border-primary/25 bg-primary/[0.06]",
          "px-4 py-3 flex items-center gap-3 hover:bg-primary/10 transition-colors",
          "native-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        )}
      >
        <div className="flex items-center justify-center size-9 rounded-full bg-primary/15 text-primary shrink-0">
          <Languages className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <p className="text-sm font-semibold">
            {daysSince} días sin practicar {goal.topic.toLowerCase()}
          </p>
          <p className="text-xs text-muted-foreground">
            {goal.daily_minutes_target} minutos con un video y vuelves al ritmo.
          </p>
        </div>
      </button>

      <button
        onClick={dismiss}
        aria-label="Cerrar recordatorio"
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
