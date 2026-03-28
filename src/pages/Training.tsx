import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useTrainingSessions,
  type TrainingSession,
  type CreateSessionData,
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
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  eachDayOfInterval,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Plus,
  Flag,
} from "lucide-react";
import { MonthSummaryBanner } from "@/components/training/MonthSummaryBanner";
import { MonthlyCalendarView } from "@/components/training/MonthlyCalendarView";
import { WeeklyCalendarView } from "@/components/training/WeeklyCalendarView";
import { SessionDetailDrawer } from "@/components/training/SessionDetailDrawer";
import { SessionFormDrawer } from "@/components/training/SessionFormDrawer";
import { TrainingGoals } from "@/components/training/TrainingGoals";
import { PeriodizationBar } from "@/components/training/PeriodizationBar";
import { WeeklyLoadChart } from "@/components/training/WeeklyLoadChart";
import ConfirmDialog from "@/components/ConfirmDialog";
import { parseISO, differenceInDays } from "date-fns";

export default function Training() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [defaultFormDate, setDefaultFormDate] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<TrainingSession | null>(null);
  const [viewMode, setViewMode] = useState<string>("month");

  // Build date range based on view mode
  const calendarDays = useMemo(() => {
    if (viewMode === "week") {
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: currentWeekStart, end: weekEnd });
    }
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth, currentWeekStart, viewMode]);

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

  const totalRows = Math.ceil(calendarDays.length / 7);

  const handleMonthChange = (newMonth: Date) => {
    setCurrentMonth(newMonth);
    if (isSameMonth(new Date(), newMonth)) {
      setSelectedDate(new Date());
    } else {
      setSelectedDate(startOfMonth(newMonth));
    }
  };

  const handleWeekChange = (newWeekStart: Date) => {
    setCurrentWeekStart(newWeekStart);
    setSelectedDate(newWeekStart);
  };

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

  // Upcoming race
  const nextRace = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return stats.upcomingRaces.sort((a, b) => a.session_date.localeCompare(b.session_date))[0] || null;
  }, [stats.upcomingRaces]);

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
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
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={setViewMode}>
              <TabsList className="h-8">
                <TabsTrigger value="month" className="text-xs">
                  Mes
                </TabsTrigger>
                <TabsTrigger value="week" className="text-xs">
                  Semana
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              size="sm"
              className="h-8"
              onClick={() => openFormCreate()}
            >
              <Plus className="h-4 w-4 mr-1" />
              Sesión
            </Button>
          </div>
        </div>

        {/* Navigator */}
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() =>
              viewMode === "month"
                ? handleMonthChange(subMonths(currentMonth, 1))
                : handleWeekChange(subWeeks(currentWeekStart, 1))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            onClick={() =>
              viewMode === "month"
                ? handleMonthChange(new Date())
                : handleWeekChange(startOfWeek(new Date(), { weekStartsOn: 1 }))
            }
            className="min-w-[160px] text-center px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
          >
            <span className="text-lg font-semibold capitalize">
              {viewMode === "month"
                ? format(currentMonth, "MMMM yyyy", { locale: es })
                : `${format(currentWeekStart, "d MMM", { locale: es })} — ${format(
                    endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
                    "d MMM",
                    { locale: es }
                  )}`}
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() =>
              viewMode === "month"
                ? handleMonthChange(addMonths(currentMonth, 1))
                : handleWeekChange(addWeeks(currentWeekStart, 1))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
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
        ) : sessions.length === 0 && viewMode === "month" ? (
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
              en Claude Code para generar un plan, o crea sesiones manualmente.
            </p>
            <Button
              className="mt-4"
              onClick={() => openFormCreate()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Crear primera sesión
            </Button>
          </div>
        ) : (
          <>
            {/* Summary Banner */}
            {viewMode === "month" && <MonthSummaryBanner stats={stats} />}

            {/* Upcoming Race */}
            {nextRace && viewMode === "month" && (
              <button
                onClick={() => openSession(nextRace)}
                className="w-full rounded-xl border border-rose-500/20 bg-gradient-to-r from-rose-500/[0.04] to-amber-500/[0.04] p-3 text-left hover:border-rose-500/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-rose-500/10">
                    <Flag className="h-4 w-4 text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {nextRace.race_name || nextRace.session_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(nextRace.session_date), "d 'de' MMMM", { locale: es })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-rose-500">
                      {differenceInDays(parseISO(nextRace.session_date), new Date())}
                    </p>
                    <p className="text-[10px] text-rose-500/80">días</p>
                  </div>
                </div>
              </button>
            )}

            {/* Periodization + Load (desktop) */}
            {viewMode === "month" && (
              <div className="hidden md:flex gap-4">
                <div className="flex-1">
                  <PeriodizationBar sessions={sessions} />
                </div>
                <div className="flex-1">
                  <WeeklyLoadChart sessions={sessions} />
                </div>
              </div>
            )}

            {/* Goals */}
            {viewMode === "month" && <TrainingGoals />}

            {/* Calendar */}
            {viewMode === "month" ? (
              <MonthlyCalendarView
                calendarDays={calendarDays}
                currentMonth={currentMonth}
                selectedDate={selectedDate}
                sessionsByDate={sessionsByDate}
                totalRows={totalRows}
                onSelectDate={setSelectedDate}
                onOpenSession={openSession}
                onAddSession={openFormCreate}
              />
            ) : (
              <WeeklyCalendarView
                currentWeekStart={currentWeekStart}
                sessionsByDate={sessionsByDate}
                onOpenSession={openSession}
                onAddSession={openFormCreate}
              />
            )}

            {/* Delete all */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={() => deleteAllSessions.mutate()}
              >
                <Dumbbell className="h-3.5 w-3.5 mr-1.5" />
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
