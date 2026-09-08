import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Screen, Row, Panel } from "@/components/HairlineGrid";
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
    /* El esqueleto imita el chasis real: identidad, la franja de pestañas
       y el cuerpo que cede. Así no salta nada al llegar los datos. */
    return (
      <Layout bleed>
        <Screen>
          <Panel className="px-4 py-3 md:px-5 lg:shrink-0">
            <div className="h-6 w-40 animate-pulse bg-muted" />
          </Panel>
          <Row className="grid-cols-4 lg:shrink-0">
            {[0, 1, 2, 3].map((i) => (
              <Panel key={i} className="px-3 py-3">
                <div className="h-3 w-full animate-pulse bg-muted" />
              </Panel>
            ))}
          </Row>
          <Panel className="p-4 md:p-5 lg:min-h-0 lg:flex-1">
            <div className="h-40 animate-pulse bg-muted lg:h-full" />
          </Panel>
        </Screen>
      </Layout>
    );
  }

  if (!goal) {
    return (
      <Layout bleed>
        <Screen>
          <Panel className="px-4 py-3 md:px-5 lg:shrink-0">
            <h1 className="page-title text-xl md:text-2xl">Aprendizaje</h1>
            <p className="eyebrow mt-1">Sin objetivo</p>
          </Panel>

          <Panel className="flex flex-col items-center justify-center gap-2 px-5 py-16 text-center lg:min-h-0 lg:flex-1">
            <p className="section-title text-base">Define qué quieres aprender</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Consume contenido real y deja que Rindo mida si de verdad estás
              entendiendo más.
            </p>
            <Button onClick={() => openGoalDialog(null)} size="lg" className="mt-3 gap-2">
              <Plus className="h-5 w-5" />
              Crear objetivo
            </Button>
          </Panel>
        </Screen>

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

  const TAB_CELL =
    "section-title min-w-0 truncate rounded-sm bg-card px-2 py-2.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:text-xs";

  return (
    <Layout bleed>
      {/* Mismo chasis que Inicio: identidad y objetivos como franjas, la
          barra de pestañas como la franja de cuatro celdas, y el cuerpo de
          la pestaña como lo que cede. El contenido de cada pestaña arma su
          propia columna de celdas (LearningOverview, LearningProgress…), así
          que acá no va padding: los paneles topan con los cantos. */}
      <Screen>
        {/* ── Fila 1 — identidad del objetivo ────────────────────── */}
        <Panel className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-5 lg:shrink-0">
          <span className="shrink-0 text-2xl leading-none">{goal.emoji}</span>
          <div className="min-w-0 flex-1">
            <h1 className="page-title truncate text-xl md:text-2xl">{goal.topic}</h1>
            {goal.north_star && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {goal.north_star}
              </p>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {stats.streakDays > 0 && (
              <span className="inline-flex items-center gap-1.5 border border-border px-2 py-1.5">
                <Flame className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-[11px] font-semibold tabular-nums">
                  {stats.streakDays}
                </span>
                <span className="eyebrow">
                  {stats.streakDays === 1 ? "día" : "días"}
                </span>
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openGoalDialog(goal)}
              className="text-muted-foreground"
              aria-label="Editar objetivo"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </Panel>

        {/* ── Fila 2 — los otros objetivos, solo si hay más de uno ─ */}
        {activeGoals.length > 1 && (
          <Panel className="flex flex-wrap items-center gap-1.5 px-4 py-2 md:px-5 lg:shrink-0">
            {activeGoals.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGoalId(g.id)}
                className={cn(
                  "flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  g.id === goal.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{g.emoji}</span>
                {g.topic}
              </button>
            ))}
            <button
              onClick={() => openGoalDialog(null)}
              className="border border-border px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Crear objetivo"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </Panel>
        )}

        {/* ── Las pestañas. El Tabs hace de contenedor de filas: la
            lista es una franja de cuatro celdas y el cuerpo es lo que
            cede y scrollea por dentro. ─────────────────────────── */}
        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex flex-col gap-px bg-border lg:min-h-0 lg:flex-1"
        >
          <TabsList className="grid h-auto w-full shrink-0 grid-cols-4 gap-px bg-border p-0">
            <TabsTrigger value="overview" className={TAB_CELL}>
              Resumen
            </TabsTrigger>
            <TabsTrigger value="sessions" className={TAB_CELL}>
              Sesiones
            </TabsTrigger>
            <TabsTrigger value="vocabulary" className={TAB_CELL}>
              Diccionario
            </TabsTrigger>
            <TabsTrigger value="progress" className={TAB_CELL}>
              Progreso
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="overview"
            className="mt-0 bg-card lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
          >
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

          <TabsContent
            value="sessions"
            className="mt-0 bg-card lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
          >
            <LearningSessionsList
              sessions={sessions}
              selected={selectedSession}
              onSelect={setSelectedSession}
              onDelete={(id) => deleteSession.mutate(id)}
            />
          </TabsContent>

          <TabsContent
            value="vocabulary"
            className="mt-0 bg-card lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
          >
            <LearningVocabulary
              items={items}
              corpus={corpus}
              onUpdate={(updates) => updateItem.mutate(updates)}
              onDelete={(id) => deleteItem.mutate(id)}
            />
          </TabsContent>

          <TabsContent
            value="progress"
            className="mt-0 bg-card lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
          >
            <LearningProgress
              stats={stats}
              sessions={sessions}
              items={items}
              corpus={corpus}
              goal={goal}
            />
          </TabsContent>
        </Tabs>
      </Screen>

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
