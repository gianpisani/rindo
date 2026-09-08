import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { differenceInCalendarDays, format } from "date-fns";
import { Languages } from "lucide-react";
import { useLearningGoals } from "@/hooks/useLearningGoals";
import { useLastLearningSession } from "@/hooks/useLearningSessions";
import type { HomeNotice } from "@/components/HomeNotices";

/** Días sin sesión antes de asomar el recordatorio. */
const NUDGE_AFTER_DAYS = 3;

const dismissKey = () => `rindo:learning-nudge:${format(new Date(), "yyyy-MM-dd")}`;

/**
 * Recordatorio de aprendizaje como aviso del inicio.
 *
 * No hace falta ninguna lista de usuarios: solo aparece si existe un objetivo
 * activo y ya hay al menos una sesión terminada. Quien no use la sección
 * nunca ve nada. Se descarta por el día.
 */
export function useLearningNotice(): HomeNotice | null {
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

  const topic = goal.topic.toLowerCase();

  return {
    id: "learning",
    icon: Languages,
    label: `${daysSince} días sin ${topic}`,
    detail: `${goal.daily_minutes_target} minutos con un video y vuelves al ritmo.`,
    tone: "primary",
    onClick: () => navigate("/learning"),
    onDismiss: () => {
      localStorage.setItem(dismissKey(), "1");
      setDismissed(true);
    },
  };
}
