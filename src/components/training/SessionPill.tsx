import { cn } from "@/lib/utils";
import { SPORT_CONFIG, INTENSITY_CONFIG } from "@/lib/training-config";
import type { TrainingSession } from "@/hooks/useTrainingSessions";
import { Flag } from "lucide-react";

interface Props {
  session: TrainingSession;
  onClick: () => void;
}

export function SessionPill({ session, onClick }: Props) {
  const sport = SPORT_CONFIG[session.sport_type] || SPORT_CONFIG.rest;
  const SportIcon = sport.icon;
  const isCompleted = session.status === "completed";
  const isSkipped = session.status === "skipped";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "w-full flex items-center gap-1 px-1.5 py-[3px] rounded-md text-[11px] font-medium transition-all",
        "hover:ring-1 hover:ring-primary/20",
        session.is_race
          ? "bg-gradient-to-r from-rose-500/10 to-amber-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20"
          : cn(sport.bg, sport.color),
        isCompleted && "opacity-50",
        isSkipped && "opacity-30"
      )}
    >
      {session.is_race ? (
        <Flag className="h-3 w-3 shrink-0" />
      ) : (
        <SportIcon className="h-3 w-3 shrink-0" />
      )}
      <span className={cn("truncate", isCompleted && "line-through")}>
        {session.is_race ? session.race_name || session.session_name : session.session_name}
      </span>
    </button>
  );
}
