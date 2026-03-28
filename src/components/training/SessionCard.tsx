import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SPORT_CONFIG, INTENSITY_CONFIG, STATUS_ICON, STATUS_COLOR, WORKOUT_SUBTYPES } from "@/lib/training-config";
import type { TrainingSession } from "@/hooks/useTrainingSessions";
import { Clock, Heart, Flag, Circle } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";

interface Props {
  session: TrainingSession;
  onClick: () => void;
}

export function SessionCard({ session, onClick }: Props) {
  const sport = SPORT_CONFIG[session.sport_type] || SPORT_CONFIG.rest;
  const intensity = INTENSITY_CONFIG[session.intensity] || INTENSITY_CONFIG.moderate;
  const SportIcon = sport.icon;
  const StatusIcon = STATUS_ICON[session.status] || Circle;

  const isRace = session.is_race;
  const daysUntilRace = isRace
    ? differenceInDays(parseISO(session.session_date), new Date())
    : 0;

  const subtype = session.workout_subtype
    ? WORKOUT_SUBTYPES[session.workout_subtype]
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border p-3 transition-all duration-200",
        "hover:border-primary/20 hover:shadow-sm",
        isRace
          ? "border-rose-500/30 bg-gradient-to-r from-rose-500/[0.03] to-amber-500/[0.03]"
          : "border-border/50",
        session.status === "completed" && "opacity-70",
        session.status === "skipped" && "opacity-50"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg shrink-0", isRace ? "bg-rose-500/10" : sport.bg)}>
          {isRace ? (
            <Flag className={cn("h-4 w-4 text-rose-500")} />
          ) : (
            <SportIcon className={cn("h-4 w-4", sport.color)} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">
              {isRace ? session.race_name || session.session_name : session.session_name}
            </span>
            {isRace && daysUntilRace > 0 && (
              <span className="text-[10px] text-rose-500 font-semibold shrink-0">
                {daysUntilRace}d
              </span>
            )}
            <StatusIcon
              className={cn("h-3.5 w-3.5 shrink-0", STATUS_COLOR[session.status])}
            />
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            {session.target_duration_minutes && (
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {session.target_duration_minutes}min
              </span>
            )}
            {session.target_hr_zone && (
              <span className="flex items-center gap-0.5">
                <Heart className="h-3 w-3" />Z{session.target_hr_zone}
              </span>
            )}
            {session.scheduled_time && <span>{session.scheduled_time}</span>}
            {subtype && (
              <span className="text-muted-foreground/60">{subtype.label}</span>
            )}
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn("text-[10px] shrink-0 border", intensity.color)}
        >
          {intensity.label}
        </Badge>
      </div>
    </button>
  );
}
