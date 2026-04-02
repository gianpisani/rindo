import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  useTrainingSessions,
  type TrainingSession,
  type CreateSessionData,
} from "@/hooks/useTrainingSessions";
import { cn } from "@/lib/utils";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  isSameWeek,
  eachDayOfInterval,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Plus,
  Flag,
  Timer,
  CalendarDays,
  TrendingUp,
} from "lucide-react";
import { SPORT_CONFIG } from "@/lib/training-config";
import { WeeklyCalendarView } from "@/components/training/WeeklyCalendarView";
import { SessionDetailDrawer } from "@/components/training/SessionDetailDrawer";
import { SessionFormDrawer } from "@/components/training/SessionFormDrawer";
import { TrainingGoals } from "@/components/training/TrainingGoals";
import { PeriodizationBar } from "@/components/training/PeriodizationBar";
import { WeeklyLoadChart } from "@/components/training/WeeklyLoadChart";
import ConfirmDialog from "@/components/ConfirmDialog";
import { parseISO, differenceInDays } from "date-fns";

export default function Training() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [defaultFormDate, setDefaultFormDate] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<TrainingSession | null>(null);

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const calendarDays = useMemo(
    () => eachDayOfInterval({ start: currentWeekStart, end: weekEnd }),
    [currentWeekStart, weekEnd]
  );

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
    createSession,
    updateSession,
    deleteSession,
    savePostFeedback,
    deleteAllSessions,
  } = useTrainingSessions(startDate, endDate);

  const isCurrentWeek = isSameWeek(currentWeekStart, new Date(), { weekStartsOn: 1 });

  const handleWeekChange = (newWeekStart: Date) => setCurrentWeekStart(newWeekStart);

  const openSession = (session: TrainingSession) => {
    setSelectedSession(session);
    setDrawerOpen(true);
  };

  const openFormCreate = (date?: string) => {
    setEditingSession(null);
    setDefaultFormDate(date);
    setFormOpen(true);
  };

  const openFormEdit = (session: TrainingSession) => {
    setEditingSession(session);
    setDefaultFormDate(undefined);
    setDrawerOpen(false);
    setFormOpen(true);
  };

  const handleFormSave = (data: CreateSessionData) => {
    if (editingSession) {
      updateSession.mutate({ id: editingSession.id, ...data });
    } else {
      createSession.mutate(data);
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteSession.mutate(deleteTarget.id);
      setDeleteTarget(null);
      setDrawerOpen(false);
    }
  };

  const nextRace = useMemo(() => {
    return stats.upcomingRaces.sort((a, b) => a.session_date.localeCompare(b.session_date))[0] || null;
  }, [stats.upcomingRaces]);

  const completionPct =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <Layout>
      <div className="space-y-5">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Entrenamiento</h1>
            {/* Mobile stats */}
            {!isLoading && sessions.length > 0 && (
              <div className="flex items-center gap-2 mt-1 sm:hidden text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  {Math.floor(stats.totalDuration / 60)}h
                  {stats.totalDuration % 60 > 0 && ` ${stats.totalDuration % 60}m`}
                </span>
                <span className="text-border/50">·</span>
                <span>{stats.total} sesiones</span>
                <span className="text-border/50">·</span>
                <span
                  className={cn(completionPct === 100 && "text-emerald-500 font-semibold")}
                >
                  {completionPct}%
                </span>
              </div>
            )}
          </div>
          <Button
            size="sm"
            className="rounded-full h-9 w-9 p-0 md:w-auto md:h-9 md:px-4 md:rounded-xl shadow-sm"
            onClick={() => openFormCreate()}
          >
            <Plus className="h-4 w-4 md:mr-1.5" />
            <span className="hidden md:inline text-sm">Sesión</span>
          </Button>
        </div>

        {/* ── Week Navigator ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => handleWeekChange(subWeeks(currentWeekStart, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() =>
                handleWeekChange(startOfWeek(new Date(), { weekStartsOn: 1 }))
              }
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all",
                isCurrentWeek
                  ? "bg-primary/8 text-primary"
                  : "hover:bg-accent text-foreground"
              )}
            >
              <span className="capitalize">
                {format(currentWeekStart, "d", { locale: es })}
                {" — "}
                {format(weekEnd, "d MMM", { locale: es })}
              </span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => handleWeekChange(addWeeks(currentWeekStart, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentWeek && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] rounded-lg ml-1 border-border/30"
                onClick={() =>
                  handleWeekChange(startOfWeek(new Date(), { weekStartsOn: 1 }))
                }
              >
                <CalendarDays className="h-3 w-3 mr-1" />
                Hoy
              </Button>
            )}
          </div>

          {/* Desktop stats */}
          {!isLoading && sessions.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Timer className="h-3 w-3 text-muted-foreground/50" />
                {Math.floor(stats.totalDuration / 60)}h
                {stats.totalDuration % 60 > 0 && ` ${stats.totalDuration % 60}m`}
              </span>
              <span className="text-border/40">·</span>
              <span>{stats.total} sesiones</span>
              <span className="text-border/40">·</span>
              <span
                className={cn(
                  "flex items-center gap-0.5",
                  completionPct === 100 && "text-emerald-500 font-semibold"
                )}
              >
                {completionPct === 100 && <TrendingUp className="h-3 w-3" />}
                {completionPct}%
              </span>
              <span className="text-border/40 hidden lg:inline">·</span>
              <div className="hidden lg:flex items-center gap-1">
                {Object.entries(stats.sportCounts).map(([sport, count]) => {
                  const config = SPORT_CONFIG[sport];
                  if (!config) return null;
                  const Icon = config.icon;
                  return (
                    <span
                      key={sport}
                      className={cn(
                        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
                        config.bg,
                        config.color
                      )}
                    >
                      <Icon className="h-2.5 w-2.5" />
                      {count}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Content ── */}
        {isLoading ? (
          <div className="hidden md:grid grid-cols-7 gap-px bg-border/20 rounded-2xl overflow-hidden border border-border/30">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-[180px] bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-5 rounded-2xl bg-muted/20 mb-5">
              <Dumbbell className="h-8 w-8 text-muted-foreground/20" />
            </div>
            <h3 className="text-base font-semibold text-muted-foreground/70">
              Sin plan esta semana
            </h3>
            <p className="text-sm text-muted-foreground/40 mt-1.5 max-w-xs leading-relaxed">
              Usa{" "}
              <code className="px-1.5 py-0.5 rounded-md bg-muted/50 text-[11px] font-mono">
                /plan-training
              </code>{" "}
              para generar un plan o crea sesiones manualmente.
            </p>
            <Button
              className="mt-5 rounded-xl shadow-sm"
              size="sm"
              onClick={() => openFormCreate()}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Crear sesión
            </Button>
          </div>
        ) : (
          <>
            <WeeklyCalendarView
              currentWeekStart={currentWeekStart}
              sessionsByDate={sessionsByDate}
              onOpenSession={openSession}
              onAddSession={openFormCreate}
            />

            {/* Upcoming Race */}
            {nextRace && (
              <button
                onClick={() => openSession(nextRace)}
                className="w-full rounded-2xl border border-rose-500/15 bg-gradient-to-r from-rose-500/[0.04] to-amber-500/[0.03] p-4 text-left hover:border-rose-500/30 hover:shadow-sm transition-all active:scale-[0.995]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/10">
                    <Flag className="h-4 w-4 text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {nextRace.race_name || nextRace.session_name}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {format(parseISO(nextRace.session_date), "d 'de' MMMM", { locale: es })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-black text-rose-500 tabular-nums">
                      {differenceInDays(parseISO(nextRace.session_date), new Date())}
                    </p>
                    <p className="text-[10px] text-rose-500/60 font-semibold">días</p>
                  </div>
                </div>
              </button>
            )}

            {/* Goals */}
            <TrainingGoals />

            {/* Periodization + Load (desktop) */}
            <div className="hidden md:flex gap-4">
              <div className="flex-1">
                <PeriodizationBar sessions={sessions} />
              </div>
              <div className="flex-1">
                <WeeklyLoadChart sessions={sessions} />
              </div>
            </div>

            {/* Delete all */}
            <div className="flex justify-end border-t border-border/15 pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] text-muted-foreground/40 hover:text-destructive rounded-lg"
                onClick={() => deleteAllSessions.mutate()}
              >
                <Dumbbell className="h-3 w-3 mr-1.5" />
                Eliminar plan
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Session Detail Drawer */}
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
        onEdit={openFormEdit}
        onDelete={(s) => setDeleteTarget(s)}
        onSaveFeedback={(id, rating, notes) => {
          savePostFeedback.mutate({ id, feeling_rating: rating, post_notes: notes });
        }}
      />

      {/* Session Form Drawer */}
      <SessionFormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        session={editingSession}
        defaultDate={defaultFormDate}
        onSave={handleFormSave}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar sesión"
        description={`¿Seguro que quieres eliminar "${deleteTarget?.session_name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="destructive"
      />
    </Layout>
  );
}
