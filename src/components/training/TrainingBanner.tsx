import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SPORT_CONFIG, INTENSITY_CONFIG } from "@/lib/training-config";
import type { TrainingSession } from "@/hooks/useTrainingSessions";
import {
  CheckCircle2,
  ChevronRight,
  Coffee,
  Flag,
} from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  sessions: TrainingSession[];
  nextRace: TrainingSession | null;
  onViewTraining: () => void;
  onComplete?: (id: string) => void;
}

export function TrainingBanner({ sessions, nextRace, onViewTraining, onComplete }: Props) {
  const pending = sessions.filter((s) => s.status === "pending");
  const allCompleted = sessions.length > 0 && pending.length === 0;
  const isRestDay = sessions.length > 0 && sessions.every((s) => s.sport_type === "rest");
  const showRace = nextRace && differenceInDays(parseISO(nextRace.session_date), new Date()) <= 60;

  // Nothing to show
  if (sessions.length === 0 && !showRace) return null;

  // Rest day
  if (isRestDay) {
    return (
      <Card
        className="p-4 border-border/50 cursor-pointer hover:border-primary/20 transition-all"
        onClick={onViewTraining}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted/50">
            <Coffee className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-muted-foreground">Día de descanso</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
        {showRace && <RaceCountdown race={nextRace!} />}
      </Card>
    );
  }

  // All completed
  if (allCompleted) {
    return (
      <Card
        className="p-4 border-emerald-500/20 cursor-pointer hover:border-emerald-500/40 transition-all"
        onClick={onViewTraining}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-500">Todo completado</p>
            <p className="text-xs text-muted-foreground">
              {sessions.length} sesion{sessions.length > 1 ? "es" : ""} hoy
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
        {showRace && <RaceCountdown race={nextRace!} />}
      </Card>
    );
  }

  // Show first pending session
  const first = pending[0] || sessions[0];
  const sport = SPORT_CONFIG[first.sport_type] || SPORT_CONFIG.rest;
  const intensity = INTENSITY_CONFIG[first.intensity] || INTENSITY_CONFIG.moderate;
  const SportIcon = sport.icon;
  const remaining = pending.length - 1;

  return (
    <Card
      className={cn(
        "p-4 border-border/50 cursor-pointer hover:border-primary/20 transition-all",
        `border-l-2`,
        sport.color.includes("orange") && "border-l-orange-500",
        sport.color.includes("blue") && "border-l-blue-500",
        sport.color.includes("cyan") && "border-l-cyan-500",
        sport.color.includes("violet") && "border-l-violet-500",
        sport.color.includes("amber") && "border-l-amber-500"
      )}
      onClick={onViewTraining}
    >
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", sport.bg)}>
          <SportIcon className={cn("h-4 w-4", sport.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Entrenamiento hoy
            </p>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm font-semibold truncate">{first.session_name}</p>
            <Badge
              variant="outline"
              className={cn("text-[9px] shrink-0 border", intensity.color)}
            >
              {intensity.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {first.target_duration_minutes && <span>{first.target_duration_minutes}min</span>}
            {first.scheduled_time && <span>{first.scheduled_time}</span>}
            {remaining > 0 && (
              <span className="text-muted-foreground/60">+{remaining} más</span>
            )}
          </div>
        </div>
        {onComplete && first.status === "pending" && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-8"
            onClick={(e) => {
              e.stopPropagation();
              onComplete(first.id);
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Button>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
      {showRace && <RaceCountdown race={nextRace!} />}
    </Card>
  );
}

function RaceCountdown({ race }: { race: TrainingSession }) {
  const days = differenceInDays(parseISO(race.session_date), new Date());
  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
      <Flag className="h-3.5 w-3.5 text-rose-500" />
      <span className="text-xs text-muted-foreground">
        {race.race_name || race.session_name} en{" "}
        <span className="font-semibold text-rose-500">{days} días</span>
      </span>
    </div>
  );
}
