import { useState } from "react";
import Layout from "@/components/Layout";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useTrainingSessions,
  type TrainingSession,
} from "@/hooks/useTrainingSessions";
import { cn } from "@/lib/utils";
import {
  format,
  startOfWeek,
  addWeeks,
  subWeeks,
  isThisWeek,
  isSameDay,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Footprints,
  Bike,
  Waves,
  Dumbbell,
  Coffee,
  Circle,
  CheckCircle2,
  XCircle,
  Clock,
  Heart,
  Gauge,
  Trash2,
  RotateCcw,
  Timer,
} from "lucide-react";

// ─── Sport Config ──────────────────────────────────────

const SPORT_CONFIG: Record<
  string,
  { icon: typeof Footprints; color: string; bg: string; label: string }
> = {
  running: { icon: Footprints, color: "text-orange-500", bg: "bg-orange-500/10", label: "Running" },
  cycling: { icon: Bike, color: "text-blue-500", bg: "bg-blue-500/10", label: "Ciclismo" },
  swimming: { icon: Waves, color: "text-cyan-500", bg: "bg-cyan-500/10", label: "Nataci\u00f3n" },
  padel: { icon: Dumbbell, color: "text-violet-500", bg: "bg-violet-500/10", label: "P\u00e1del" },
  strength: { icon: Dumbbell, color: "text-amber-500", bg: "bg-amber-500/10", label: "Fuerza" },
  rest: { icon: Coffee, color: "text-muted-foreground", bg: "bg-muted/50", label: "Descanso" },
};

const INTENSITY_CONFIG: Record<string, { label: string; color: string }> = {
  easy: { label: "Suave", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  moderate: { label: "Moderado", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  hard: { label: "Intenso", color: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
  recovery: { label: "Recuperaci\u00f3n", color: "text-sky-500 bg-sky-500/10 border-sky-500/20" },
  rest: { label: "Descanso", color: "text-muted-foreground bg-muted/50 border-border/50" },
};

const STATUS_ICON: Record<string, typeof Circle> = {
  pending: Circle,
  completed: CheckCircle2,
  skipped: XCircle,
};

const STATUS_COLOR: Record<string, string> = {
  pending: "text-muted-foreground",
  completed: "text-emerald-500",
  skipped: "text-rose-400",
};

// ─── Session Card ──────────────────────────────────────

function SessionCard({
  session,
  onClick,
}: {
  session: TrainingSession;
  onClick: () => void;
}) {
  const sport = SPORT_CONFIG[session.sport_type] || SPORT_CONFIG.rest;
  const intensity = INTENSITY_CONFIG[session.intensity] || INTENSITY_CONFIG.moderate;
  const SportIcon = sport.icon;
  const StatusIcon = STATUS_ICON[session.status] || Circle;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border border-border/50 p-3 transition-all duration-200",
        "hover:border-primary/20 hover:shadow-sm",
        session.status === "completed" && "opacity-70",
        session.status === "skipped" && "opacity-50"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg shrink-0", sport.bg)}>
          <SportIcon className={cn("h-4 w-4", sport.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{session.session_name}</span>
            <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", STATUS_COLOR[session.status])} />
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
                <Heart className="h-3 w-3" />
                Z{session.target_hr_zone}
              </span>
            )}
            {session.scheduled_time && (
              <span>{session.scheduled_time}</span>
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

// ─── Session Detail Drawer ─────────────────────────────

function SessionDetailDrawer({
  session,
  open,
  onClose,
  onComplete,
  onSkip,
  onReset,
}: {
  session: TrainingSession | null;
  open: boolean;
  onClose: () => void;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
  onReset: (id: string) => void;
}) {
  if (!session) return null;
  const sport = SPORT_CONFIG[session.sport_type] || SPORT_CONFIG.rest;
  const intensity = INTENSITY_CONFIG[session.intensity] || INTENSITY_CONFIG.moderate;
  const SportIcon = sport.icon;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", sport.bg)}>
              <SportIcon className={cn("h-5 w-5", sport.color)} />
            </div>
            <div>
              <SheetTitle className="text-left">{session.session_name}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                {format(parseISO(session.session_date), "EEEE d 'de' MMMM", { locale: es })}
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Status + Intensity */}
          <div className="flex items-center gap-2">
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
              {session.status === "completed" ? "Completada" : session.status === "skipped" ? "Omitida" : "Pendiente"}
            </Badge>
          </div>

          {/* Description */}
          {session.description && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Descripci\u00f3n
              </h4>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{session.description}</p>
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
                    <p className="text-xs text-muted-foreground">Duraci\u00f3n</p>
                    <p className="text-sm font-semibold">{session.target_duration_minutes} min</p>
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
                  </div>
                </div>
              )}
              {session.target_pace_min_km && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <Footprints className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ritmo</p>
                    <p className="text-sm font-semibold">{session.target_pace_min_km}/km</p>
                  </div>
                </div>
              )}
              {session.target_power_watts && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Potencia</p>
                    <p className="text-sm font-semibold">{session.target_power_watts}W</p>
                  </div>
                </div>
              )}
              {session.scheduled_time && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Horario</p>
                    <p className="text-sm font-semibold">{session.scheduled_time}</p>
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

// ─── Week Summary Banner ───────────────────────────────

function WeekSummaryBanner({
  weekStats,
}: {
  weekStats: {
    total: number;
    completed: number;
    totalDuration: number;
    sportCounts: Record<string, number>;
  };
}) {
  const completionPct = weekStats.total > 0 ? Math.round((weekStats.completed / weekStats.total) * 100) : 0;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-r from-primary/[0.03] via-card to-card p-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-6">
          {/* Duration */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Timer className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Duraci\u00f3n</p>
              <p className="text-sm font-bold font-mono tabular-nums">
                {Math.floor(weekStats.totalDuration / 60)}h {weekStats.totalDuration % 60}m
              </p>
            </div>
          </div>

          {/* Sessions */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sesiones</p>
            <p className="text-sm font-bold font-mono tabular-nums">{weekStats.total}</p>
          </div>

          {/* Completion */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Completado</p>
            <p className="text-sm font-bold font-mono tabular-nums">{completionPct}%</p>
          </div>
        </div>

        {/* Sport pills */}
        <div className="flex items-center gap-1.5">
          {Object.entries(weekStats.sportCounts).map(([sport, count]) => {
            const config = SPORT_CONFIG[sport];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <div
                key={sport}
                className={cn("flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", config.bg, config.color)}
              >
                <Icon className="h-3 w-3" />
                {count}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────

export default function Training() {
  const [currentWeek, setCurrentWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const weekStartStr = format(currentWeek, "yyyy-MM-dd");
  const {
    sessions,
    isLoading,
    sessionsByDate,
    weekStats,
    markCompleted,
    markSkipped,
    resetSession,
    deleteWeekSessions,
  } = useTrainingSessions(weekStartStr);

  const isCurrentWeek = isThisWeek(currentWeek, { weekStartsOn: 1 });
  const today = new Date();

  const openSession = (session: TrainingSession) => {
    setSelectedSession(session);
    setDrawerOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* ─── Header ─────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Entrenamiento</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Cargando..."
                : sessions.length > 0
                ? `${sessions.length} sesiones planificadas`
                : "Sin plan para esta semana"}
            </p>
          </div>

          {/* Week Navigator */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() => !isCurrentWeek && setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              className={cn(
                "min-w-[200px] text-center px-3 py-1.5 rounded-lg transition-colors",
                !isCurrentWeek ? "hover:bg-accent cursor-pointer" : "cursor-default"
              )}
            >
              <span className="text-lg font-semibold">
                {format(currentWeek, "d", { locale: es })} - {format(addWeeks(currentWeek, 1), "d MMM yyyy", { locale: es })}
              </span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentWeek && (
              <Button
                variant="outline"
                size="sm"
                className="ml-2 text-xs h-7 rounded-lg"
                onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              >
                Esta semana
              </Button>
            )}
          </div>
        </div>

        {/* ─── Content ────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          /* ─── Empty State ────────────────── */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Dumbbell className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">
              Sin plan de entrenamiento
            </h3>
            <p className="text-sm text-muted-foreground/60 mt-1 max-w-md">
              Usa <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">/plan-training</code>{" "}
              en Claude Code para generar un plan personalizado basado en tus datos de Garmin.
            </p>
          </div>
        ) : (
          <>
            {/* ─── Week Summary ──────────── */}
            <WeekSummaryBanner weekStats={weekStats} />

            {/* ─── 7-Day Grid ────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {Object.entries(sessionsByDate).map(([dateStr, daySessions]) => {
                const date = parseISO(dateStr);
                const isToday = isSameDay(date, today);
                const dayName = format(date, "EEE", { locale: es });
                const dayNum = format(date, "d");

                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "rounded-xl border p-3 min-h-[120px] transition-all duration-200",
                      isToday
                        ? "border-primary/40 bg-primary/[0.02]"
                        : "border-border/50 bg-card"
                    )}
                  >
                    {/* Day Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        {dayName}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md",
                          isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                        )}
                      >
                        {dayNum}
                      </span>
                    </div>

                    {/* Sessions */}
                    <div className="space-y-2">
                      {daySessions.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground/40 text-center py-4">
                          Sin sesiones
                        </p>
                      ) : (
                        daySessions.map((session) => (
                          <SessionCard
                            key={session.id}
                            session={session}
                            onClick={() => openSession(session)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ─── Delete Week ────────────── */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={() => deleteWeekSessions.mutate()}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Eliminar plan semanal
              </Button>
            </div>
          </>
        )}
      </div>

      {/* ─── Session Detail Drawer ────────── */}
      <SessionDetailDrawer
        session={selectedSession}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onComplete={(id) => {
          markCompleted.mutate(id);
          setDrawerOpen(false);
        }}
        onSkip={(id) => {
          markSkipped.mutate(id);
          setDrawerOpen(false);
        }}
        onReset={(id) => {
          resetSession.mutate(id);
          setDrawerOpen(false);
        }}
      />
    </Layout>
  );
}
