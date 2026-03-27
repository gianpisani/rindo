import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
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
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  parseISO,
  eachDayOfInterval,
  isToday,
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

// ─── Config ──────────────────────────────────────────

const SPORT_CONFIG: Record<
  string,
  { icon: typeof Footprints; color: string; bg: string; dot: string; label: string }
> = {
  running: {
    icon: Footprints,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    dot: "bg-orange-500",
    label: "Running",
  },
  cycling: {
    icon: Bike,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    dot: "bg-blue-500",
    label: "Ciclismo",
  },
  swimming: {
    icon: Waves,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    dot: "bg-cyan-500",
    label: "Natación",
  },
  padel: {
    icon: Dumbbell,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    dot: "bg-violet-500",
    label: "Pádel",
  },
  strength: {
    icon: Dumbbell,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    dot: "bg-amber-500",
    label: "Fuerza",
  },
  rest: {
    icon: Coffee,
    color: "text-muted-foreground",
    bg: "bg-muted/50",
    dot: "bg-muted-foreground/40",
    label: "Descanso",
  },
};

const INTENSITY_CONFIG: Record<string, { label: string; color: string }> = {
  easy: {
    label: "Suave",
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
  moderate: {
    label: "Moderado",
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  hard: {
    label: "Intenso",
    color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
  },
  recovery: {
    label: "Recuperación",
    color: "text-sky-500 bg-sky-500/10 border-sky-500/20",
  },
  rest: {
    label: "Descanso",
    color: "text-muted-foreground bg-muted/50 border-border/50",
  },
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

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// ─── Session Pill (compact, for calendar cells) ──────

function SessionPill({
  session,
  onClick,
}: {
  session: TrainingSession;
  onClick: () => void;
}) {
  const sport = SPORT_CONFIG[session.sport_type] || SPORT_CONFIG.rest;
  const intensity = INTENSITY_CONFIG[session.intensity] || INTENSITY_CONFIG.moderate;
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
        sport.bg,
        sport.color,
        isCompleted && "opacity-50",
        isSkipped && "opacity-30"
      )}
    >
      <SportIcon className="h-3 w-3 shrink-0" />
      <span className={cn("truncate", isCompleted && "line-through")}>
        {session.session_name}
      </span>
    </button>
  );
}

// ─── Session Card (mobile selected day) ──────────────

function SessionCard({
  session,
  onClick,
}: {
  session: TrainingSession;
  onClick: () => void;
}) {
  const sport = SPORT_CONFIG[session.sport_type] || SPORT_CONFIG.rest;
  const intensity =
    INTENSITY_CONFIG[session.intensity] || INTENSITY_CONFIG.moderate;
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
            <span className="text-sm font-semibold truncate">
              {session.session_name}
            </span>
            <StatusIcon
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                STATUS_COLOR[session.status]
              )}
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

// ─── Session Detail Drawer ───────────────────────────

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
  const intensity =
    INTENSITY_CONFIG[session.intensity] || INTENSITY_CONFIG.moderate;
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
              <SheetTitle className="text-left">
                {session.session_name}
              </SheetTitle>
              <p className="text-sm text-muted-foreground capitalize">
                {format(parseISO(session.session_date), "EEEE d 'de' MMMM", {
                  locale: es,
                })}
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
              {session.status === "completed"
                ? "Completada"
                : session.status === "skipped"
                ? "Omitida"
                : "Pendiente"}
            </Badge>
          </div>

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
                    <p className="text-sm font-semibold">
                      {session.target_pace_min_km}/km
                    </p>
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
            {(session.status === "completed" ||
              session.status === "skipped") && (
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

// ─── Month Summary Banner ────────────────────────────

function MonthSummaryBanner({
  stats,
}: {
  stats: {
    total: number;
    completed: number;
    totalDuration: number;
    sportCounts: Record<string, number>;
  };
}) {
  const completionPct =
    stats.total > 0
      ? Math.round((stats.completed / stats.total) * 100)
      : 0;

  return (
    <div className="rounded-xl border border-border/50 bg-gradient-to-r from-primary/[0.03] via-card to-card p-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-6">
          {/* Duration */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Timer className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Duración
              </p>
              <p className="text-sm font-bold font-mono tabular-nums">
                {Math.floor(stats.totalDuration / 60)}h{" "}
                {stats.totalDuration % 60}m
              </p>
            </div>
          </div>

          {/* Sessions */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Sesiones
            </p>
            <p className="text-sm font-bold font-mono tabular-nums">
              {stats.total}
            </p>
          </div>

          {/* Completion */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Completado
            </p>
            <p className="text-sm font-bold font-mono tabular-nums">
              {completionPct}%
            </p>
          </div>
        </div>

        {/* Sport pills */}
        <div className="flex items-center gap-1.5">
          {Object.entries(stats.sportCounts).map(([sport, count]) => {
            const config = SPORT_CONFIG[sport];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <div
                key={sport}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                  config.bg,
                  config.color
                )}
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

// ─── Main Component ──────────────────────────────────

export default function Training() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [selectedSession, setSelectedSession] =
    useState<TrainingSession | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Build calendar grid (pad to full weeks)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const startDate = format(calendarDays[0], "yyyy-MM-dd");
  const endDate = format(calendarDays[calendarDays.length - 1], "yyyy-MM-dd");

  const {
    sessions,
    isLoading,
    sessionsByDate,
    stats,
    markCompleted,
    markSkipped,
    resetSession,
    deleteAllSessions,
  } = useTrainingSessions(startDate, endDate);

  const totalRows = Math.ceil(calendarDays.length / 7);

  const handleMonthChange = (newMonth: Date) => {
    setCurrentMonth(newMonth);
    if (isSameMonth(new Date(), newMonth)) {
      setSelectedDate(new Date());
    } else {
      setSelectedDate(startOfMonth(newMonth));
    }
  };

  const openSession = (session: TrainingSession) => {
    setSelectedSession(session);
    setDrawerOpen(true);
  };

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const selectedDaySessions = sessionsByDate[selectedDateStr] || [];

  return (
    <Layout>
      <div className="space-y-4">
        {/* ─── Header ─────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">
              Entrenamiento
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Cargando..."
                : sessions.length > 0
                ? `${sessions.length} sesiones planificadas`
                : "Sin plan para este mes"}
            </p>
          </div>

          {/* Month Navigator */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => handleMonthChange(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() => handleMonthChange(new Date())}
              className="min-w-[160px] text-center px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
            >
              <span className="text-lg font-semibold capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: es })}
              </span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => handleMonthChange(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ─── Content ────────────────────────── */}
        {isLoading ? (
          <div className="rounded-xl border border-border/40 overflow-hidden">
            <div className="grid grid-cols-7">
              {Array.from({ length: 35 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 md:h-24 bg-muted/20 animate-pulse border-b border-r border-border/20"
                />
              ))}
            </div>
          </div>
        ) : sessions.length === 0 ? (
          /* ─── Empty State ────────────────── */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Dumbbell className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">
              Sin plan de entrenamiento
            </h3>
            <p className="text-sm text-muted-foreground/60 mt-1 max-w-md">
              Usa{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                /plan-training
              </code>{" "}
              en Claude Code para generar un plan personalizado basado en tus
              datos de Garmin.
            </p>
          </div>
        ) : (
          <>
            {/* ─── Summary ────────────────── */}
            <MonthSummaryBanner stats={stats} />

            {/* ─── Calendar Grid ──────────── */}
            <div className="rounded-xl border border-border/40 overflow-hidden bg-card">
              {/* Day headers */}
              <div className="grid grid-cols-7 bg-muted/30">
                {DAY_NAMES.map((name, i) => (
                  <div
                    key={name}
                    className={cn(
                      "py-2 text-center",
                      i < 6 && "border-r border-border/20"
                    )}
                  >
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, i) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const daySessions = sessionsByDate[dateStr] || [];
                  const dayIsToday = isToday(day);
                  const inMonth = isSameMonth(day, currentMonth);
                  const isSelected = isSameDay(day, selectedDate);
                  const col = i % 7;
                  const row = Math.floor(i / 7);
                  const isLastRow = row === totalRows - 1;

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "min-h-[56px] md:min-h-[90px] p-1 md:p-1.5 cursor-pointer transition-colors relative",
                        col < 6 && "border-r border-border/20",
                        !isLastRow && "border-b border-border/20",
                        !inMonth && "bg-muted/10",
                        dayIsToday && inMonth && "bg-primary/[0.04]",
                        isSelected && "ring-2 ring-primary/30 ring-inset",
                        "hover:bg-accent/20"
                      )}
                    >
                      {/* Day number */}
                      <div className="flex justify-end mb-0.5">
                        <span
                          className={cn(
                            "text-[11px] md:text-xs tabular-nums w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full transition-colors",
                            dayIsToday &&
                              "bg-primary text-primary-foreground font-bold",
                            !dayIsToday &&
                              inMonth &&
                              "text-foreground",
                            !dayIsToday &&
                              !inMonth &&
                              "text-muted-foreground/40"
                          )}
                        >
                          {format(day, "d")}
                        </span>
                      </div>

                      {/* Desktop: session pills */}
                      <div className="hidden md:flex flex-col gap-0.5">
                        {daySessions.map((s) => (
                          <SessionPill
                            key={s.id}
                            session={s}
                            onClick={() => openSession(s)}
                          />
                        ))}
                      </div>

                      {/* Mobile: colored dots */}
                      <div className="flex md:hidden gap-[3px] justify-center flex-wrap mt-0.5">
                        {daySessions.map((s) => {
                          const sport =
                            SPORT_CONFIG[s.sport_type] || SPORT_CONFIG.rest;
                          return (
                            <div
                              key={s.id}
                              className={cn(
                                "w-[5px] h-[5px] rounded-full",
                                sport.dot,
                                s.status === "completed" && "opacity-50",
                                s.status === "skipped" && "opacity-25"
                              )}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── Mobile: Selected Day Detail ── */}
            <div className="md:hidden space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold capitalize">
                  {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                </h3>
                {isToday(selectedDate) && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                  >
                    Hoy
                  </Badge>
                )}
              </div>
              {selectedDaySessions.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 py-4 text-center">
                  Sin sesiones
                </p>
              ) : (
                selectedDaySessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onClick={() => openSession(session)}
                  />
                ))
              )}
            </div>

            {/* ─── Delete ─────────────────── */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={() => deleteAllSessions.mutate()}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Eliminar plan
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
