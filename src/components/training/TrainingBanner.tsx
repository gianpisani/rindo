import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SPORT_CONFIG, INTENSITY_CONFIG } from "@/lib/training-config";
import type { TrainingSession } from "@/hooks/useTrainingSessions";
import {
  CheckCircle2,
  ChevronRight,
  Coffee,
  Flag,
  Clock,
  XCircle,
  Footprints,
  Route,
} from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  sessions: TrainingSession[];
  nextRace: TrainingSession | null;
  onViewTraining: () => void;
  onComplete?: (id: string) => void;
  onSkip?: (id: string) => void;
}

export function TrainingBanner({ sessions, nextRace, onViewTraining, onComplete, onSkip }: Props) {
  const pending = sessions.filter((s) => s.status === "pending");
  const completed = sessions.filter((s) => s.status === "completed");
  const allCompleted = sessions.length > 0 && pending.length === 0;
  const isRestDay = sessions.length > 0 && sessions.every((s) => s.sport_type === "rest");
  const showRace = nextRace && differenceInDays(parseISO(nextRace.session_date), new Date()) <= 60;
  const raceIsToday = nextRace && nextRace.session_date === format(new Date(), "yyyy-MM-dd");

  if (sessions.length === 0 && !showRace) return null;

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
          Entrenamiento hoy
        </h2>
        <button
          onClick={onViewTraining}
          className="text-xs text-muted-foreground/40 hover:text-primary flex items-center gap-0.5 transition-colors"
        >
          Ver plan
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Rest day */}
      {isRestDay && (
        <div className="rounded-2xl border border-dashed border-border/30 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-muted/30">
              <Coffee className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-muted-foreground/60">Día de descanso</p>
              {sessions[0]?.description && (
                <p className="text-xs text-muted-foreground/40 mt-0.5 line-clamp-1">
                  {sessions[0].description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All completed */}
      {allCompleted && !isRestDay && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Todo completado</p>
              <p className="text-xs text-muted-foreground/50 mt-0.5">
                {completed.length} sesion{completed.length > 1 ? "es" : ""} hoy
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pending sessions — each one gets its own card with inline actions */}
      {!isRestDay && !allCompleted && (
        <div className="space-y-2">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              onOpen={onViewTraining}
              onComplete={onComplete}
              onSkip={onSkip}
            />
          ))}
        </div>
      )}

      {/* Race countdown — only if race is NOT today (today it shows as a session above) */}
      {showRace && !raceIsToday && (
        <button
          onClick={onViewTraining}
          className="w-full rounded-2xl border border-rose-500/15 bg-gradient-to-r from-rose-500/[0.04] to-amber-500/[0.03] px-4 py-3 text-left hover:border-rose-500/25 transition-all active:scale-[0.995]"
        >
          <div className="flex items-center gap-3">
            <Flag className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            <span className="text-xs text-muted-foreground/70 flex-1 truncate">
              {nextRace!.race_name || nextRace!.session_name}
            </span>
            <span className="text-xs font-black text-rose-500 tabular-nums">
              {differenceInDays(parseISO(nextRace!.session_date), new Date())}d
            </span>
          </div>
        </button>
      )}
    </div>
  );
}

/* ─── Individual session row with inline actions ─── */

function SessionRow({
  session,
  onOpen,
  onComplete,
  onSkip,
}: {
  session: TrainingSession;
  onOpen: () => void;
  onComplete?: (id: string) => void;
  onSkip?: (id: string) => void;
}) {
  const sport = SPORT_CONFIG[session.sport_type] || SPORT_CONFIG.rest;
  const intensity = INTENSITY_CONFIG[session.intensity] || INTENSITY_CONFIG.moderate;
  const SportIcon = sport.icon;
  const isRace = session.is_race;
  const isPending = session.status === "pending";
  const isCompleted = session.status === "completed";
  const isSkipped = session.status === "skipped";

  return (
    <div
      className={cn(
        "group rounded-2xl border overflow-hidden transition-all",
        isRace
          ? "border-rose-500/20 bg-gradient-to-r from-rose-500/[0.03] to-amber-500/[0.02]"
          : "border-border/40",
        isCompleted && "border-emerald-500/15 bg-emerald-500/[0.02]",
        isSkipped && "opacity-50"
      )}
    >
      {/* Accent bar */}
      <div className={cn("h-[2px]", isRace ? "bg-gradient-to-r from-rose-500 to-amber-500" : sport.dot)} />

      <div className="p-3.5">
        <div className="flex items-center gap-3">
          {/* Sport icon */}
          <button
            onClick={onOpen}
            className={cn("p-2.5 rounded-xl shrink-0 transition-colors", isRace ? "bg-rose-500/10" : sport.bg)}
          >
            {isRace ? (
              <Flag className="h-[18px] w-[18px] text-rose-500" />
            ) : (
              <SportIcon className={cn("h-[18px] w-[18px]", sport.color)} />
            )}
          </button>

          {/* Info — tappable to open detail */}
          <button onClick={onOpen} className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-sm font-semibold truncate",
                isCompleted && "line-through text-muted-foreground/60"
              )}>
                {isRace ? session.race_name || session.session_name : session.session_name}
              </span>
              <Badge
                variant="outline"
                className={cn("text-[9px] shrink-0 border rounded-full font-semibold", intensity.color)}
              >
                {intensity.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground/50">
              {session.target_duration_minutes && (
                <span className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {session.target_duration_minutes} min
                </span>
              )}
              {session.target_distance_meters && session.target_distance_meters >= 1000 && (
                <span className="flex items-center gap-0.5">
                  <Route className="h-3 w-3" />
                  {(session.target_distance_meters / 1000).toFixed(1)}km
                </span>
              )}
              {session.target_pace_min_km && (
                <span className="flex items-center gap-0.5">
                  <Footprints className="h-3 w-3" />
                  {session.target_pace_min_km}/km
                </span>
              )}
              {session.scheduled_time && <span>{session.scheduled_time}</span>}
            </div>
          </button>

          {/* Quick actions — the magic: one-tap complete/skip */}
          {isPending && (
            <div className="flex items-center gap-1 shrink-0">
              {onSkip && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSkip(session.id);
                  }}
                  className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground/30 hover:text-rose-400 hover:bg-rose-500/10 transition-all active:scale-90"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
              {onComplete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onComplete(session.id);
                  }}
                  className="h-9 w-9 flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all active:scale-90"
                >
                  <CheckCircle2 className="h-5 w-5" />
                </button>
              )}
            </div>
          )}

          {/* Status indicator for non-pending */}
          {isCompleted && (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          )}
          {isSkipped && (
            <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
        </div>

        {/* Coach notes preview — what to actually do */}
        {isPending && session.coach_notes && (
          <p className="text-[11px] text-muted-foreground/40 mt-2 pl-[52px] line-clamp-2 leading-relaxed italic">
            {session.coach_notes}
          </p>
        )}
      </div>
    </div>
  );
}
