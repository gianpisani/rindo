import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SPORT_CONFIG,
  INTENSITY_CONFIG,
  WORKOUT_SUBTYPES,
  TRAINING_PHASES,
} from "@/lib/training-config";
import type { TrainingSession } from "@/hooks/useTrainingSessions";
import { PostSessionFeedback } from "./PostSessionFeedback";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Timer,
  Gauge,
  Heart,
  Footprints,
  Clock,
  Pencil,
  Trash2,
  Flag,
  Wifi,
  Route,
} from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  session: TrainingSession | null;
  open: boolean;
  onClose: () => void;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
  onReset: (id: string) => void;
  onEdit: (session: TrainingSession) => void;
  onDelete: (session: TrainingSession) => void;
  onSaveFeedback: (id: string, rating: number, notes: string) => void;
}

export function SessionDetailDrawer({
  session,
  open,
  onClose,
  onComplete,
  onSkip,
  onReset,
  onEdit,
  onDelete,
  onSaveFeedback,
}: Props) {
  if (!session) return null;

  const sport = SPORT_CONFIG[session.sport_type] || SPORT_CONFIG.rest;
  const intensity = INTENSITY_CONFIG[session.intensity] || INTENSITY_CONFIG.moderate;
  const SportIcon = sport.icon;
  const isRace = session.is_race;
  const daysUntil = isRace
    ? differenceInDays(parseISO(session.session_date), new Date())
    : 0;
  const subtype = session.workout_subtype ? WORKOUT_SUBTYPES[session.workout_subtype] : null;
  const phase = session.training_phase ? TRAINING_PHASES[session.training_phase] : null;
  const isGarminSynced = !!session.garmin_synced_at || !!session.garmin_activity_id;

  // Collect target metrics
  const metrics = [
    session.target_duration_minutes && {
      icon: Timer,
      label: "Duración",
      value: `${session.target_duration_minutes} min`,
      actual: session.actual_duration_minutes ? `${session.actual_duration_minutes} min` : null,
    },
    session.target_distance_meters && {
      icon: Route,
      label: "Distancia",
      value:
        session.target_distance_meters >= 1000
          ? `${(session.target_distance_meters / 1000).toFixed(1)} km`
          : `${session.target_distance_meters} m`,
      actual: session.actual_distance_meters
        ? session.actual_distance_meters >= 1000
          ? `${(session.actual_distance_meters / 1000).toFixed(1)} km`
          : `${session.actual_distance_meters} m`
        : null,
    },
    session.target_hr_zone && {
      icon: Heart,
      label: "Zona HR",
      value: `Z${session.target_hr_zone}${
        session.target_hr_min && session.target_hr_max
          ? ` (${session.target_hr_min}–${session.target_hr_max})`
          : ""
      }`,
      actual: session.actual_avg_hr ? `${session.actual_avg_hr} bpm` : null,
    },
    session.target_pace_min_km && {
      icon: Footprints,
      label: "Ritmo",
      value: `${session.target_pace_min_km}/km`,
      actual: session.actual_avg_pace ? `${session.actual_avg_pace}/km` : null,
    },
    session.target_power_watts && {
      icon: Gauge,
      label: "Potencia",
      value: `${session.target_power_watts}W`,
      actual: null,
    },
    session.scheduled_time && {
      icon: Clock,
      label: "Horario",
      value: session.scheduled_time,
      actual: null,
    },
  ].filter(Boolean) as Array<{
    icon: typeof Timer;
    label: string;
    value: string;
    actual: string | null;
  }>;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "p-3 rounded-xl shrink-0",
                isRace ? "bg-rose-500/10" : sport.bg
              )}
            >
              {isRace ? (
                <Flag className="h-5 w-5 text-rose-500" />
              ) : (
                <SportIcon className={cn("h-5 w-5", sport.color)} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-left truncate text-lg">
                {isRace ? session.race_name || session.session_name : session.session_name}
              </SheetTitle>
              <p className="text-sm text-muted-foreground/70 capitalize mt-0.5">
                {format(parseISO(session.session_date), "EEEE d 'de' MMMM", { locale: es })}
              </p>
            </div>
            <div className="flex gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => onEdit(session)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-destructive/60 hover:text-destructive"
                onClick={() => onDelete(session)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Race countdown */}
          {isRace && daysUntil > 0 && (
            <div className="rounded-2xl bg-gradient-to-br from-rose-500/10 to-amber-500/10 border border-rose-500/15 p-4 text-center">
              <p className="text-3xl font-black text-rose-500 tabular-nums">{daysUntil}</p>
              <p className="text-xs text-rose-500/70 font-semibold mt-0.5">
                días para la carrera
              </p>
              {session.race_distance_label && (
                <p className="text-xs text-muted-foreground mt-1.5">{session.race_distance_label}</p>
              )}
            </div>
          )}

          {/* Badges row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className={cn("border rounded-full text-[11px] font-semibold", intensity.color)}
            >
              {intensity.label}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "border rounded-full text-[11px] font-semibold",
                session.status === "completed"
                  ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                  : session.status === "skipped"
                  ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                  : "text-muted-foreground"
              )}
            >
              {session.status === "completed"
                ? "Completada"
                : session.status === "skipped"
                ? "Omitida"
                : "Pendiente"}
            </Badge>
            {subtype && (
              <Badge variant="outline" className="rounded-full text-[11px] text-muted-foreground">
                {subtype.label}
              </Badge>
            )}
            {phase && (
              <Badge variant="outline" className="rounded-full text-[11px] text-muted-foreground">
                {phase.label}
              </Badge>
            )}
            {isRace && (
              <Badge
                variant="outline"
                className="rounded-full text-[11px] text-rose-500 bg-rose-500/10 border-rose-500/20"
              >
                Carrera
              </Badge>
            )}
          </div>

          {/* Garmin sync */}
          {isGarminSynced && (
            <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/5 rounded-lg px-3 py-2">
              <Wifi className="h-3.5 w-3.5" />
              <span className="font-medium">Sincronizado con Garmin</span>
              {session.garmin_activity_name && (
                <span className="text-muted-foreground">— {session.garmin_activity_name}</span>
              )}
            </div>
          )}

          {/* Description */}
          {session.description && (
            <div>
              <h4 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2.5">
                Descripción
              </h4>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                {session.description}
              </p>
            </div>
          )}

          {/* Targets */}
          {metrics.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">
                Objetivos
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {metrics.map((m) => {
                  const Icon = m.icon;
                  return (
                    <div
                      key={m.label}
                      className="p-3 rounded-xl bg-muted/20 border border-border/10"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        <p className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">
                          {m.label}
                        </p>
                      </div>
                      <p className="text-base font-bold tabular-nums">{m.value}</p>
                      {m.actual && (
                        <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border/10">
                          <div className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-[11px] text-emerald-500 font-semibold tabular-nums">
                            {m.actual}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Coach Notes */}
          {session.coach_notes && (
            <div>
              <h4 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2.5">
                Notas del Coach
              </h4>
              <div className="p-3.5 rounded-xl bg-primary/[0.03] border border-primary/10 text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                {session.coach_notes}
              </div>
            </div>
          )}

          {/* Post-session Feedback */}
          {session.status === "completed" && (
            <PostSessionFeedback
              sessionId={session.id}
              currentRating={session.feeling_rating}
              currentNotes={session.post_notes}
              onSave={(rating, notes) => onSaveFeedback(session.id, rating, notes)}
            />
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {session.status === "pending" && (
              <>
                <Button
                  className="flex-[2] rounded-xl h-12 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  onClick={() => onComplete(session.id)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Completar
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 rounded-xl h-12 text-muted-foreground/60 hover:text-rose-400"
                  onClick={() => onSkip(session.id)}
                >
                  <XCircle className="h-4 w-4 mr-1.5" />
                  Omitir
                </Button>
              </>
            )}
            {(session.status === "completed" || session.status === "skipped") && (
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-11"
                onClick={() => onReset(session.id)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restaurar
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
