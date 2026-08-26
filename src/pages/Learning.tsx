import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Flame } from "lucide-react";
import { toast } from "sonner";

import { useLearningGoals, type LearningGoal } from "@/hooks/useLearningGoals";
import {
  useLearningSessions,
  type LearningSession,
  type SessionWithItemCount,
} from "@/hooks/useLearningSessions";
import { contentProgress, formatClock } from "@/lib/learning-config";
import { useLearningItems } from "@/hooks/useLearningItems";
import { useLearningQueue, type QueueItem } from "@/hooks/useLearningQueue";
import { useLearningStats } from "@/hooks/useLearningStats";
import { useCorpus } from "@/hooks/useCorpus";
import {
  useActiveLearningSession,
  type StartSessionInput,
  type ReflectionInput,
} from "@/hooks/useActiveLearningSession";

import { GoalSetupDialog } from "@/components/learning/GoalSetupDialog";
import { StartSessionDialog } from "@/components/learning/StartSessionDialog";
import { SessionStudio } from "@/components/learning/SessionStudio";
import { ReflectionDialog } from "@/components/learning/ReflectionDialog";
import { SessionCompleteCard } from "@/components/learning/SessionCompleteCard";
import { LearningOverview } from "@/components/learning/LearningOverview";
import { LearningQueue } from "@/components/learning/LearningQueue";
import { ContinueWatching } from "@/components/learning/ContinueWatching";
import { LearningSessionsList } from "@/components/learning/LearningSessionsList";
import { LearningVocabulary } from "@/components/learning/LearningVocabulary";
import { LearningProgress } from "@/components/learning/LearningProgress";

export default function Learning() {
  const { goals, activeGoals, isLoading: goalsLoading, createGoal, updateGoal } =
    useLearningGoals();

  const session = useActiveLearningSession();

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");

  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<LearningGoal | null>(null);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [completed, setCompleted] = useState<LearningSession | null>(null);
  /**
   * Salir del estudio sin cerrar la sesión: queda pausada y se puede volver.
   * Es estado de la vista, no de los datos.
   */
  const [minimized, setMinimized] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionWithItemCount | null>(
    null
  );

  // El objetivo por defecto es el primero activo; si hay una sesión abierta,
  // manda el objetivo de esa sesión.
  useEffect(() => {
    if (session.session) {
      setSelectedGoalId(session.session.goal_id);
      return;
    }
    if (!selectedGoalId && activeGoals.length > 0) {
      setSelectedGoalId(activeGoals[0].id);
    }
  }, [session.session, activeGoals, selectedGoalId]);

  // Cualquier cambio de sesión (nueva, terminada o descartada) sale del estado
  // minimizado. Minimizar no cambia el id, así que no se pisa a sí mismo.
  const openSessionId = session.session?.id;
  useEffect(() => {
    setMinimized(false);
  }, [openSessionId]);

  const goal = useMemo(
    () => goals.find((g) => g.id === selectedGoalId) ?? activeGoals[0] ?? null,
    [goals, selectedGoalId, activeGoals]
  );

  const { sessions, unfinished, deleteSession, markContentFinished } =
    useLearningSessions(goal?.id);
  const { items, updateItem, deleteItem } = useLearningItems(goal?.id);
  const { queue, add: addToQueue, markWatched, remove: removeFromQueue } =
    useLearningQueue(goal?.id);
  const stats = useLearningStats(sessions);

  /**
   * El corpus: todo el inglés que has escuchado, indexado contra el ranking de
   * uso del idioma. Es lo que convierte al diccionario en una medición y no en
   * una lista, así que se arma acá arriba y lo comparten las dos pestañas.
   */
  const titles = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const source of [...sessions, ...unfinished, ...queue]) {
      if (source.external_id) map.set(source.external_id, source.content_title);
    }
    return map;
  }, [sessions, unfinished, queue]);

  /**
   * Lo escuchado de verdad: solo lo que tiene sesión. Tener la transcripción
   * pegada no es haber escuchado nada.
   */
  const watchedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const source of [...sessions, ...unfinished]) {
      if (source.external_id) ids.add(source.external_id);
    }
    return ids;
  }, [sessions, unfinished]);

  const stopped = useMemo(() => items.map((i) => i.expression), [items]);
  const corpus = useCorpus({ titles, watchedIds, stopped });

  // ── Acciones ──────────────────────────────────────────────

  /**
   * Si ya viste parte de este video antes, se retoma donde ibas.
   * Un ?t= explícito en el link manda por sobre eso.
   */
  const resumePositionFor = (externalId?: string | null) => {
    if (!externalId) return 0;
    const previous = sessions.find((s) => s.external_id === externalId);
    if (!previous) return 0;
    return contentProgress(previous).isPartial ? previous.last_position_seconds : 0;
  };

  const handleStart = (input: StartSessionInput, startSeconds: number) => {
    const resumeAt = startSeconds || resumePositionFor(input.external_id);

    session.start.mutate(
      { ...input, last_position_seconds: Math.round(resumeAt) },
      {
        onSuccess: () => {
          setStartDialogOpen(false);
          toast.success(
            resumeAt > 0 ? "Retomando donde ibas" : "Sesión iniciada",
            {
              description:
                resumeAt > 0
                  ? `Desde ${formatClock(resumeAt)}`
                  : "Pausar el video para investigar no detiene el reloj.",
            }
          );
        },
      }
    );
  };

  /** Empezar directamente desde algo guardado en la lista. */
  const handleStartFromQueue = (item: QueueItem) => {
    session.start.mutate(
      {
        goal_id: item.goal_id,
        content_type: item.content_type,
        content_url: item.content_url,
        external_id: item.external_id,
        content_title: item.content_title,
        content_author: item.content_author,
        content_thumbnail: item.content_thumbnail,
        content_duration_seconds: item.content_duration_seconds,
      },
      {
        onSuccess: (started) => {
          markWatched.mutate({ id: item.id, sessionId: started.id });
        },
      }
    );
  };

  /** Retomar un contenido a medias, exactamente donde quedó. */
  const handleContinue = (previous: SessionWithItemCount) => {
    session.start.mutate(
      {
        goal_id: previous.goal_id,
        content_type: previous.content_type,
        content_url: previous.content_url,
        external_id: previous.external_id,
        content_title: previous.content_title,
        content_author: previous.content_author,
        content_thumbnail: previous.content_thumbnail,
        content_duration_seconds: previous.content_duration_seconds,
        last_position_seconds: previous.last_position_seconds,
      },
      {
        onSuccess: () =>
          toast.success("Retomando donde ibas", {
            description: `Desde ${formatClock(previous.last_position_seconds)}`,
          }),
      }
    );
  };

  /**
   * Volver al resumen sin terminar. La vista cambia al tiro y la pausa —que
   * es la que guarda el tiempo y el minuto— se manda en paralelo.
   */
  const handleLeaveSession = () => {
    setMinimized(true);
    if (session.isActive) session.pause();
    toast.success("Sesión pausada", {
      description: "Quedó guardado dónde ibas.",
    });
  };

  /**
   * Lo que te está esperando al abrir la vista: la sesión abierta si la hay, o
   * si no lo último que dejaste a medias. Es lo que manda el héroe, y por eso
   * no vuelve a aparecer en la fila de abajo.
   */
  const featured: LearningSession | null =
    session.session ?? unfinished[0] ?? null;
  const featuredIsLive = !!session.session;

  const handleResumeFeatured = () => {
    if (session.session) {
      setMinimized(false);
      return;
    }
    if (unfinished[0]) handleContinue(unfinished[0]);
  };

  const handleFinishReflection = (reflection: ReflectionInput) => {
    session.finish.mutate(reflection, {
      onSuccess: (finished) => {
        setReflectionOpen(false);
        if (finished) setCompleted(finished);
      },
    });
  };

  const openGoalDialog = (target: LearningGoal | null) => {
    setEditingGoal(target);
    setGoalDialogOpen(true);
  };

  const handleSaveGoal = (draft: Parameters<typeof createGoal.mutate>[0]) => {
    if (editingGoal) {
      updateGoal.mutate(
        { id: editingGoal.id, ...draft },
        { onSuccess: () => setGoalDialogOpen(false) }
      );
    } else {
      createGoal.mutate(draft, {
        onSuccess: (created) => {
          setSelectedGoalId(created.id);
          setGoalDialogOpen(false);
        },
      });
    }
  };

  // ── Estados de carga y vacío ──────────────────────────────

  if (goalsLoading || session.isLoading) {
    return (
      <Layout>
        <div className="space-y-3 animate-pulse">
          <div className="h-8 w-40 rounded-lg bg-muted" />
          <div className="h-40 rounded-2xl bg-muted" />
          <div className="h-24 rounded-2xl bg-muted" />
        </div>
      </Layout>
    );
  }

  if (!goal) {
    return (
      <Layout>
        <div className="max-w-md mx-auto py-12 text-center">
          <h1 className="text-2xl font-bold">Aprendizaje</h1>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            Define qué quieres aprender, consume contenido real y deja que Rindo
            mida si de verdad estás entendiendo más.
          </p>
          <Button
            onClick={() => openGoalDialog(null)}
            className="mt-6 h-12 px-6 rounded-xl font-semibold"
          >
            <Plus className="h-5 w-5 mr-2" />
            Crear objetivo
          </Button>
        </div>

        <GoalSetupDialog
          open={goalDialogOpen}
          onOpenChange={setGoalDialogOpen}
          goal={editingGoal}
          onSave={handleSaveGoal}
          isSaving={createGoal.isPending}
        />
      </Layout>
    );
  }

  // ── Sesión en curso: el estudio toma la pantalla ──────────

  if (session.session && !minimized) {
    return (
      <Layout>
        <SessionStudio
          session={session.session}
          isPaused={!!session.isPaused}
          isVideoPlaying={session.isVideoPlaying}
          liveEffectiveSeconds={session.liveEffectiveSeconds}
          liveElapsedSeconds={session.liveElapsedSeconds}
          startSeconds={session.session.last_position_seconds}
          onPause={session.pause}
          onResume={session.resume}
          onFinish={() => setReflectionOpen(true)}
          onLeave={handleLeaveSession}
          onDiscard={() => session.discard.mutate()}
          onPlayback={session.reportPlayback}
          onMeta={session.saveMeta}
          onActivity={session.registerActivity}
        />

        <ReflectionDialog
          open={reflectionOpen}
          onOpenChange={setReflectionOpen}
          onSubmit={handleFinishReflection}
          isSubmitting={session.finish.isPending}
          progress={contentProgress({
            last_position_seconds: Math.max(
              session.lastPositionSeconds,
              session.session.last_position_seconds
            ),
            content_duration_seconds: session.session.content_duration_seconds,
          })}
        />
      </Layout>
    );
  }

  // ── Vista normal ──────────────────────────────────────────

  return (
    <Layout>
      <div className="space-y-5">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl leading-none">{goal.emoji}</span>
              <h1 className="text-2xl font-bold tracking-tight truncate">
                {goal.topic}
              </h1>
              {stats.streakDays > 0 && (
                <span className="flex items-center gap-1 text-primary shrink-0">
                  <Flame className="h-4 w-4" />
                  <span className="text-sm font-bold tabular-nums">
                    {stats.streakDays}
                  </span>
                </span>
              )}
            </div>
            {goal.north_star && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {goal.north_star}
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => openGoalDialog(goal)}
            className="rounded-xl shrink-0 text-muted-foreground"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>

        {/* Selector de objetivos, solo si hay más de uno */}
        {activeGoals.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {activeGoals.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGoalId(g.id)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
                  "flex items-center gap-1.5",
                  g.id === goal.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                <span>{g.emoji}</span>
                {g.topic}
              </button>
            ))}
            <button
              onClick={() => openGoalDialog(null)}
              className="px-2.5 py-1.5 rounded-xl border border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Pestañas */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-4 h-10">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              Resumen
            </TabsTrigger>
            <TabsTrigger value="sessions" className="text-xs sm:text-sm">
              Sesiones
            </TabsTrigger>
            <TabsTrigger value="vocabulary" className="text-xs sm:text-sm">
              Diccionario
            </TabsTrigger>
            <TabsTrigger value="progress" className="text-xs sm:text-sm">
              Progreso
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <LearningOverview
              goal={goal}
              stats={stats}
              sessions={sessions}
              onStart={() => setStartDialogOpen(true)}
              featured={featured}
              featuredIsLive={featuredIsLive}
              onResumeFeatured={handleResumeFeatured}
              onOpenSession={(s) => {
                setSelectedSession(s);
                setTab("sessions");
              }}
              continueSlot={
                <ContinueWatching
                  unfinished={unfinished}
                  featured={featured}
                  onContinue={handleContinue}
                  onDismiss={(s) => markContentFinished.mutate(s)}
                />
              }
              queueSlot={
                <LearningQueue
                  queue={queue}
                  onAdd={(draft) =>
                    addToQueue.mutate({ ...draft, goal_id: goal.id })
                  }
                  onStart={handleStartFromQueue}
                  onRemove={(id) => removeFromQueue.mutate(id)}
                  isAdding={addToQueue.isPending}
                />
              }
            />
          </TabsContent>

          <TabsContent value="sessions" className="mt-4">
            <LearningSessionsList
              sessions={sessions}
              selected={selectedSession}
              onSelect={setSelectedSession}
              onDelete={(id) => deleteSession.mutate(id)}
            />
          </TabsContent>

          <TabsContent value="vocabulary" className="mt-4">
            <LearningVocabulary
              items={items}
              corpus={corpus}
              onUpdate={(updates) => updateItem.mutate(updates)}
              onDelete={(id) => deleteItem.mutate(id)}
            />
          </TabsContent>

          <TabsContent value="progress" className="mt-4">
            <LearningProgress
              stats={stats}
              sessions={sessions}
              items={items}
              corpus={corpus}
              goal={goal}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Diálogos */}
      <GoalSetupDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        goal={editingGoal}
        onSave={handleSaveGoal}
        isSaving={createGoal.isPending || updateGoal.isPending}
      />

      <StartSessionDialog
        open={startDialogOpen}
        onOpenChange={setStartDialogOpen}
        goalId={goal.id}
        onStart={handleStart}
        isStarting={session.start.isPending}
      />

      {completed && (
        <SessionCompleteCard
          open={!!completed}
          onOpenChange={(open) => !open && setCompleted(null)}
          session={completed}
          todayMinutes={stats.today.effectiveSeconds / 60}
          dailyTargetMinutes={goal.daily_minutes_target}
          streakDays={stats.streakDays}
        />
      )}
    </Layout>
  );
}
