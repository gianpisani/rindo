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

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", isRace ? "bg-rose-500/10" : sport.bg)}>
              {isRace ? (
                <Flag className="h-5 w-5 text-rose-500" />
              ) : (
                <SportIcon className={cn("h-5 w-5", sport.color)} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-left truncate">
                {isRace ? session.race_name || session.session_name : session.session_name}
              </SheetTitle>
              <p className="text-sm text-muted-foreground capitalize">
                {format(parseISO(session.session_date), "EEEE d 'de' MMMM", { locale: es })}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(session)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(session)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Race countdown */}
          {isRace && daysUntil > 0 && (
            <div className="rounded-lg bg-gradient-to-r from-rose-500/10 to-amber-500/10 border border-rose-500/20 p-3 text-center">
              <p className="text-2xl font-bold text-rose-500">{daysUntil}</p>
              <p className="text-xs text-rose-500/80 font-medium">días para la carrera</p>
              {session.race_distance_label && (
                <p className="text-xs text-muted-foreground mt-1">{session.race_distance_label}</p>
              )}
            </div>
          )}

          {/* Status + Intensity + Subtype */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn("border", intensity.color)}>
              {intensity.label}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "border",
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
              <Badge variant="outline" className="text-muted-foreground">
                {subtype.label}
              </Badge>
            )}
            {phase && (
              <Badge variant="outline" className="text-muted-foreground">
                {phase.label}
              </Badge>
            )}
            {isRace && (
              <Badge variant="outline" className="text-rose-500 bg-rose-500/10 border-rose-500/20">
                Carrera
              </Badge>
            )}
          </div>

          {/* Garmin sync status */}
          {isGarminSynced && (
            <div className="flex items-center gap-2 text-xs text-emerald-500">
              <Wifi className="h-3.5 w-3.5" />
              <span>Sincronizado con Garmin</span>
              {session.garmin_activity_name && (
                <span className="text-muted-foreground">— {session.garmin_activity_name}</span>
              )}
            </div>
          )}
          {!isGarminSynced && session.status === "completed" && (
            <p className="text-xs text-muted-foreground/60">
              Sin actividad Garmin vinculada
            </p>
          )}

          {/* Description */}
          {session.description && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Descripción
              </h4>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {session.description}
              </p>
            </div>
          )}

          {/* Targets */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Objetivos
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {session.target_duration_minutes && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Duración</p>
                    <p className="text-sm font-semibold">
                      {session.target_duration_minutes} min
                    </p>
                    {session.actual_duration_minutes && (
                      <p className="text-xs text-emerald-500">
                        Real: {session.actual_duration_minutes} min
                      </p>
                    )}
                  </div>
                </div>
              )}
              {session.target_distance_meters && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Distancia</p>
                    <p className="text-sm font-semibold">
                      {session.target_distance_meters >= 1000
                        ? `${(session.target_distance_meters / 1000).toFixed(1)} km`
                        : `${session.target_distance_meters} m`}
                    </p>
                    {session.actual_distance_meters && (
                      <p className="text-xs text-emerald-500">
                        Real: {session.actual_distance_meters >= 1000
                          ? `${(session.actual_distance_meters / 1000).toFixed(1)} km`
                          : `${session.actual_distance_meters} m`}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {session.target_hr_zone && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <Heart className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Zona HR</p>
                    <p className="text-sm font-semibold">
                      Z{session.target_hr_zone}
                      {session.target_hr_min && session.target_hr_max && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({session.target_hr_min}-{session.target_hr_max})
                        </span>
                      )}
                    </p>
                    {session.actual_avg_hr && (
                      <p className="text-xs text-emerald-500">
                        Real: {session.actual_avg_hr} bpm
                      </p>
                    )}
                  </div>
                </div>
              )}
              {session.target_pace_min_km && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <Footprints className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ritmo</p>
                    <p className="text-sm font-semibold">
                      {session.target_pace_min_km}/km
                    </p>
                    {session.actual_avg_pace && (
                      <p className="text-xs text-emerald-500">
                        Real: {session.actual_avg_pace}/km
                      </p>
                    )}
                  </div>
                </div>
              )}
              {session.target_power_watts && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Potencia</p>
                    <p className="text-sm font-semibold">
                      {session.target_power_watts}W
                    </p>
                  </div>
                </div>
              )}
              {session.scheduled_time && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Horario</p>
                    <p className="text-sm font-semibold">
                      {session.scheduled_time}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Coach Notes */}
          {session.coach_notes && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Notas del Coach
              </h4>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-sm leading-relaxed whitespace-pre-wrap">
                {session.coach_notes}
              </div>
            </div>
          )}

          {/* Post-session Feedback (when completed) */}
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
                  className="flex-1"
                  onClick={() => onComplete(session.id)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Completar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onSkip(session.id)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Omitir
                </Button>
              </>
            )}
            {(session.status === "completed" || session.status === "skipped") && (
              <Button
                variant="outline"
                className="flex-1"
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
