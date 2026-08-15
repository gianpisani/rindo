import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ConfirmDialog from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Pause,
  Play,
  Plus,
  Flag,
  Trash2,
  Highlighter,
  Zap,
  Check,
  ArrowLeft,
  Eye,
  ChevronDown,
  ExternalLink,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { YouTubePlayer, type YouTubePlayerHandle, type VideoMeta } from "./YouTubePlayer";
import { TranscriptPanel } from "./TranscriptPanel";
import { WordLookup } from "./WordLookup";
import {
  CAPTURE_TYPES,
  detectItemType,
  formatClock,
  formatDuration,
  youTubeWatchUrl,
  type ItemType,
} from "@/lib/learning-config";
import type { Cue } from "@/lib/transcript";
import type { LearningSession } from "@/hooks/useLearningSessions";
import { useLearningItems, useSessionItems } from "@/hooks/useLearningItems";
import { useCaptureKeyboard } from "@/hooks/useKeyboardCapture";
import { useAutoCapture } from "@/hooks/useAutoCapture";

interface SessionStudioProps {
  session: LearningSession;
  isPaused: boolean;
  isVideoPlaying: boolean;
  liveEffectiveSeconds: number;
  liveElapsedSeconds: number;
  startSeconds: number;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  /** Salir sin terminar: pausa, guarda el minuto y vuelve al resumen. */
  onLeave: () => void;
  onDiscard: () => void;
  onPlayback: (positionSeconds: number, playing: boolean) => void;
  onMeta: (meta: VideoMeta) => void;
  onActivity: () => void;
}

/**
 * El estudio ocupa la pantalla completa menos la cabecera de la app y el
 * padding del main (3.5rem + 3rem).
 */
const STUDIO_HEIGHT = "lg:h-[calc(100vh-6.5rem)]";

/**
 * Ancho máximo del video, derivado del alto que queda libre: así el video se
 * hace todo lo grande que la pantalla permita sin empujar nada fuera de vista.
 * Descuenta la barra de estado, la fila de controles y los espacios.
 *
 * Su columna lleva `justify-center` porque en pantallas altas el límite pasa a
 * ser el ancho, y el video queda centrado en vez de dejar un hueco abajo.
 */
const VIDEO_MAX_WIDTH = "calc((100vh - 15.5rem) * 16 / 9)";

export function SessionStudio({
  session,
  isPaused,
  isVideoPlaying,
  liveEffectiveSeconds,
  liveElapsedSeconds,
  startSeconds,
  onPause,
  onResume,
  onFinish,
  onLeave,
  onDiscard,
  onPlayback,
  onMeta,
  onActivity,
}: SessionStudioProps) {
  // Espacio, flechas y E son del estudio mientras esté abierto.
  useCaptureKeyboard();

  const playerRef = useRef<YouTubePlayerHandle>(null);
  const expressionRef = useRef<HTMLInputElement>(null);

  const { capture, updateItem } = useLearningItems(session.goal_id);
  const { data: captured = [] } = useSessionItems(session.id);

  const auto = useAutoCapture({
    goalId: session.goal_id,
    sessionId: session.id,
    capture,
    updateItem,
  });

  const hasPlayer = session.content_type === "youtube" && !!session.external_id;

  const [positionSeconds, setPositionSeconds] = useState(startSeconds);

  const handlePlayback = useCallback(
    (seconds: number, playing: boolean) => {
      setPositionSeconds(Math.floor(seconds));
      onPlayback(seconds, playing);
    },
    [onPlayback]
  );

  // ── Formulario de captura ─────────────────────────────────

  const [isCapturing, setIsCapturing] = useState(false);
  const [expression, setExpression] = useState("");
  const [context, setContext] = useState("");
  const [meaning, setMeaning] = useState("");
  const [translation, setTranslation] = useState<string | null>(null);
  const [itemType, setItemType] = useState<ItemType>("expression");
  const [typeTouched, setTypeTouched] = useState(false);
  /** En automático el formulario es solo lectura: ya se guardó. */
  const [alreadySaved, setAlreadySaved] = useState(false);
  const capturedAtRef = useRef<number | null>(null);
  const wasPlayingRef = useRef(false);

  const holdVideo = useCallback(() => {
    wasPlayingRef.current = playerRef.current?.isPlaying() ?? false;
    if (wasPlayingRef.current) playerRef.current?.pause();
  }, []);

  const openCapture = useCallback(() => {
    if (isPaused) return;
    holdVideo();
    capturedAtRef.current = hasPlayer
      ? Math.round(playerRef.current?.getCurrentTime() ?? 0)
      : null;
    setAlreadySaved(false);
    setIsCapturing(true);
    onActivity();
    requestAnimationFrame(() => expressionRef.current?.focus());
  }, [hasPlayer, isPaused, onActivity, holdVideo]);

  const pickFromTranscript = useCallback(
    (term: string, cue: Cue) => {
      if (isPaused) return;

      holdVideo();

      // En automático la ficha se ve igual; lo único que cambia es que ya
      // quedó guardada y no hay que apretar nada.
      if (auto.enabled) auto.captureNow(term, cue.text, cue.t);

      capturedAtRef.current = cue.t;
      setExpression(term);
      setContext(cue.text);
      setMeaning("");
      setTranslation(null);
      setItemType(detectItemType(term));
      setTypeTouched(false);
      setAlreadySaved(auto.enabled);
      setIsCapturing(true);
      onActivity();
    },
    [isPaused, onActivity, holdVideo, auto]
  );

  const closeCapture = useCallback((resumeVideo: boolean) => {
    setIsCapturing(false);
    setExpression("");
    setContext("");
    setMeaning("");
    setTranslation(null);
    setItemType("expression");
    setTypeTouched(false);
    setAlreadySaved(false);
    capturedAtRef.current = null;
    if (resumeVideo && wasPlayingRef.current) playerRef.current?.play();
    wasPlayingRef.current = false;
  }, []);

  const submitCapture = useCallback(() => {
    const value = expression.trim();
    if (!value) return;

    capture.mutate(
      {
        goal_id: session.goal_id,
        session_id: session.id,
        expression: value,
        context: context.trim() || null,
        meaning: meaning.trim() || null,
        translation_es: translation,
        timestamp_seconds: capturedAtRef.current,
        item_type: itemType,
      },
      {
        onSuccess: (result) => {
          if (!result.was_new) {
            toast.success(`“${result.item.expression}” otra vez`, {
              description: `La has visto ${result.item.times_seen} veces`,
            });
          }
          // Si guardaste antes de que respondiera el diccionario, se completa
          // igual en segundo plano: una expresión sin traducción no sirve.
          if (!result.item.meaning || !result.item.translation_es) {
            void auto.enrich(result.item.id, value);
          }
        },
      }
    );

    // La fila ya está en la lista: se cierra sin esperar al servidor.
    closeCapture(true);
  }, [
    expression,
    context,
    meaning,
    translation,
    itemType,
    capture,
    auto,
    session.goal_id,
    session.id,
    closeCapture,
  ]);

  useEffect(() => {
    if (!isCapturing || typeTouched) return;
    setItemType(detectItemType(expression));
  }, [expression, isCapturing, typeTouched]);

  // ── Atajos ────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (inField) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        openCapture();
        return;
      }

      if (!hasPlayer) return;

      if (e.key === " ") {
        e.preventDefault();
        playerRef.current?.toggle();
        onActivity();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        playerRef.current?.seekBy(-10);
        onActivity();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        playerRef.current?.seekBy(10);
        onActivity();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openCapture, hasPlayer, onActivity]);

  // ── Estado visual ─────────────────────────────────────────

  const state: "studying" | "researching" | "paused" = isPaused
    ? "paused"
    : isVideoPlaying || !hasPlayer
      ? "studying"
      : "researching";

  const stateConfig = {
    studying: {
      label: "Estudiando",
      dot: "bg-emerald-500",
      text: "text-emerald-500",
      ring: "border-emerald-500/25",
      note: null as string | null,
    },
    researching: {
      label: "Investigando",
      dot: "bg-amber-500",
      text: "text-amber-500",
      ring: "border-amber-500/25",
      note: "el reloj sigue: buscar una palabra también es estudiar",
    },
    paused: {
      label: "Pausada",
      dot: "bg-muted-foreground",
      text: "text-muted-foreground",
      ring: "border-border",
      note: "el tiempo efectivo está detenido",
    },
  }[state];

  const [confirmDiscard, setConfirmDiscard] = useState(false);

  /**
   * Cuál de las expresiones capturadas está abierta. Solo una a la vez: la
   * lista vive en una columna angosta y dos fichas abiertas la vuelven ilegible.
   */
  const [openItem, setOpenItem] = useState<string | null>(null);

  const controls = (
    <>
      <Button
        onClick={onLeave}
        variant="ghost"
        size="sm"
        aria-label="Volver sin terminar"
        title="Volver — se guarda el minuto donde quedaste"
        className="rounded-xl h-9 px-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      {isPaused ? (
        <Button onClick={onResume} size="sm" className="rounded-xl h-9 font-semibold">
          <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
          Reanudar
        </Button>
      ) : (
        <Button
          onClick={onPause}
          variant="outline"
          size="sm"
          className="rounded-xl h-9 font-medium"
        >
          <Pause className="h-3.5 w-3.5 mr-1.5" />
          Pausar
        </Button>
      )}

      <Button
        onClick={onFinish}
        variant="outline"
        size="sm"
        className="rounded-xl h-9 font-medium border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
      >
        <Flag className="h-3.5 w-3.5 mr-1.5" />
        Terminar
      </Button>

      <Button
        onClick={() => setConfirmDiscard(true)}
        variant="ghost"
        size="sm"
        aria-label="Descartar sesión"
        className="rounded-xl h-9 px-2 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </>
  );

  return (
    <div
      className={cn("flex flex-col gap-3", STUDIO_HEIGHT)}
      onPointerDown={onActivity}
    >
      {/* ── Barra de estado ──────────────────────────────── */}
      <div
        className={cn(
          "rounded-2xl border bg-card px-4 py-3 transition-colors shrink-0",
          stateConfig.ring
        )}
      >
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                {state === "studying" && (
                  <span
                    className={cn(
                      "absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping",
                      stateConfig.dot
                    )}
                  />
                )}
                <span
                  className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", stateConfig.dot)}
                />
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider shrink-0",
                  stateConfig.text
                )}
              >
                {stateConfig.label}
              </span>
              {stateConfig.note && (
                <span className="text-[11px] text-muted-foreground truncate hidden lg:inline">
                  · {stateConfig.note}
                </span>
              )}
            </div>

            <p className="font-semibold truncate mt-1 leading-tight">
              {session.content_title ?? "Cargando…"}
            </p>
            {session.content_author && (
              <p className="text-[11px] text-muted-foreground truncate">
                {session.content_author}
              </p>
            )}
          </div>

          <div className="text-right shrink-0">
            <p className="text-2xl sm:text-3xl font-bold tabular-nums leading-none">
              {formatClock(liveEffectiveSeconds)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              efectivo · {formatDuration(liveElapsedSeconds)} total
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2 shrink-0 border-l border-border/50 pl-4">
            {controls}
          </div>
        </div>

        <div className="flex md:hidden items-center gap-2 mt-3">{controls}</div>
      </div>

      {/* ── Video (izquierda) · subtítulos + captura (derecha) ── */}
      <div
        className={cn(
          "flex-1 min-h-0 grid gap-3",
          hasPlayer ? "lg:grid-cols-10" : "lg:grid-cols-1"
        )}
      >
        {/* Columna del video */}
        {hasPlayer ? (
          <div className="flex flex-col justify-center gap-1.5 min-h-0 min-w-0 lg:col-span-7">
            <div
              className="mx-auto w-full rounded-2xl overflow-hidden border border-border/60 bg-black aspect-video"
              style={{ maxWidth: VIDEO_MAX_WIDTH }}
            >
              <YouTubePlayer
                ref={playerRef}
                videoId={session.external_id!}
                startSeconds={startSeconds}
                onMeta={onMeta}
                onPlayback={handlePlayback}
                className="h-full w-full"
              />
            </div>

            <div className="flex items-center gap-1 text-muted-foreground shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  playerRef.current?.seekBy(-10);
                  onActivity();
                }}
                className="rounded-lg h-7 px-2"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                <span className="text-[11px]">10s</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  playerRef.current?.seekBy(10);
                  onActivity();
                }}
                className="rounded-lg h-7 px-2"
              >
                <RotateCw className="h-3.5 w-3.5 mr-1" />
                <span className="text-[11px]">10s</span>
              </Button>
              <span className="hidden xl:inline text-[10px] ml-1">
                Espacio play/pausa · ← → 10s · E capturar
              </span>
              <div className="flex-1" />
              {session.external_id && (
                <a
                  href={youTubeWatchUrl(session.external_id, positionSeconds)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] hover:text-foreground transition-colors flex items-center gap-1 pr-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  YouTube
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-8 text-center">
            <p className="text-sm font-medium">{session.content_title}</p>
            <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto">
              Este contenido se reproduce fuera de Rindo. El cronómetro de
              arriba mide tu tiempo de estudio igual.
            </p>
            {session.content_url && (
              <Button variant="outline" size="sm" asChild className="mt-4 rounded-xl">
                <a href={session.content_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Abrir
                </a>
              </Button>
            )}
          </div>
        )}

        {/* Columna derecha: subtítulos arriba, captura abajo */}
        <div className="flex flex-col gap-3 min-h-0 min-w-0 lg:col-span-3">
          {hasPlayer && (
            <TranscriptPanel
              externalId={session.external_id!}
              positionSeconds={positionSeconds}
              onPick={pickFromTranscript}
              onSeek={(seconds) => {
                playerRef.current?.seekTo(seconds);
                onActivity();
              }}
              className="flex-1 min-h-0 lg:max-h-none max-h-[40vh]"
            />
          )}

          <div
            className={cn(
              "rounded-2xl border border-border/60 bg-card flex flex-col overflow-hidden",
              "flex-[1.15] min-h-0 lg:max-h-none max-h-[50vh]"
            )}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Highlighter className="h-3.5 w-3.5 text-primary shrink-0" />
                <h3 className="text-xs font-semibold shrink-0">Capturar</h3>
                {isCapturing && capturedAtRef.current !== null && (
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                    en {formatClock(capturedAtRef.current)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={auto.toggle}
                  title={
                    auto.enabled
                      ? "Automatico: tocar una palabra la guarda sola con su significado"
                      : "Activar guardado automatico al tocar una palabra"
                  }
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-1.5 py-1 transition-colors",
                    "text-[10px] font-bold uppercase tracking-wide",
                    auto.enabled
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Zap className={cn("h-3 w-3", auto.enabled && "fill-current")} />
                  Auto
                </button>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {captured.length}
                </span>
              </div>
            </div>

            <div
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3"
              onTouchMove={(e) => e.stopPropagation()}
            >
              {isCapturing ? (
                <div className="space-y-2.5">
                  <Input
                    ref={expressionRef}
                    value={expression}
                    onChange={(e) => setExpression(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitCapture();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        closeCapture(true);
                      }
                    }}
                    placeholder="come across"
                    className="h-10 rounded-xl font-medium"
                  />

                  {expression.trim().length > 1 && (
                    <WordLookup
                      term={expression}
                      contextSentence={context}
                      onUseDefinition={setMeaning}
                      onTranslation={setTranslation}
                    />
                  )}

                  <Textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        submitCapture();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        closeCapture(true);
                      }
                    }}
                    placeholder="La frase donde apareció (opcional)"
                    rows={2}
                    className="rounded-xl resize-none text-sm"
                  />

                  {meaning && (
                    <Input
                      value={meaning}
                      onChange={(e) => setMeaning(e.target.value)}
                      placeholder="Significado"
                      className="h-9 rounded-xl text-xs"
                    />
                  )}

                  <div className={cn("flex flex-wrap gap-1.5", alreadySaved && "hidden")}>
                    {CAPTURE_TYPES.map(({ type, label, hint }) => (
                      <button
                        key={type}
                        title={hint}
                        onClick={() => {
                          setItemType(type);
                          setTypeTouched(true);
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all",
                          itemType === type
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {alreadySaved ? (
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500">
                        <Check className="h-3.5 w-3.5" />
                        Guardada
                      </span>
                      <div className="flex-1" />
                      <Button
                        onClick={() => closeCapture(true)}
                        className="rounded-xl h-9 font-semibold"
                      >
                        <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                        Seguir
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-0.5">
                      <Button
                        onClick={submitCapture}
                        disabled={!expression.trim()}
                        className="flex-1 rounded-xl h-9 font-semibold"
                      >
                        Guardar
                      </Button>
                      <Button
                        onClick={() => closeCapture(true)}
                        variant="ghost"
                        className="rounded-xl h-9"
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Button
                    onClick={openCapture}
                    disabled={isPaused}
                    variant="outline"
                    className="w-full rounded-xl h-10 border-dashed font-medium"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva expresión
                    <kbd className="ml-2 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">
                      E
                    </kbd>
                  </Button>

                  <div className="mt-3">
                    {captured.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground text-center py-4 px-1 leading-relaxed">
                        Haz clic en cualquier palabra de los subtítulos. El
                        video se pausa solo y vuelve a andar al guardar.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {captured
                          .slice()
                          .reverse()
                          .map((item) => {
                            // El significado en español manda; el inglés queda
                            // debajo porque es el que enseña el matiz.
                            const sense = item.meaning_es ?? item.meaning;
                            const canOpen = !!(sense || item.context);
                            const isOpen = openItem === item.sighting_id;

                            return (
                              <div
                                key={item.sighting_id}
                                className={cn(
                                  "rounded-xl border bg-muted/20 transition-all duration-200",
                                  item.pending && "opacity-60",
                                  isOpen
                                    ? "border-border bg-muted/40"
                                    : "border-border/50 hover:border-border hover:bg-muted/40"
                                )}
                              >
                                <div className="flex items-baseline gap-2 px-3 py-2">
                                  <button
                                    onClick={() =>
                                      setOpenItem(isOpen ? null : item.sighting_id)
                                    }
                                    disabled={!canOpen}
                                    aria-expanded={canOpen ? isOpen : undefined}
                                    className="flex-1 min-w-0 flex items-baseline gap-1.5 text-left disabled:cursor-default"
                                  >
                                    <span className="text-sm font-medium truncate shrink-0 max-w-[55%]">
                                      {item.expression}
                                    </span>
                                    {item.translation_es && (
                                      <>
                                        <span className="text-[10px] text-muted-foreground shrink-0">
                                          ·
                                        </span>
                                        <span className="text-xs text-primary font-medium truncate">
                                          {item.translation_es}
                                        </span>
                                      </>
                                    )}
                                    {canOpen && (
                                      <ChevronDown
                                        className={cn(
                                          "h-3 w-3 shrink-0 self-center text-muted-foreground transition-transform",
                                          isOpen && "rotate-180"
                                        )}
                                      />
                                    )}
                                  </button>

                                  {item.timestamp_seconds !== null &&
                                    (hasPlayer ? (
                                      <button
                                        onClick={() => {
                                          playerRef.current?.seekTo(
                                            item.timestamp_seconds!
                                          );
                                          onActivity();
                                        }}
                                        title="Volver a ese momento"
                                        className="text-[10px] text-muted-foreground tabular-nums shrink-0 hover:text-primary transition-colors"
                                      >
                                        {formatClock(item.timestamp_seconds)}
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                        {formatClock(item.timestamp_seconds)}
                                      </span>
                                    ))}
                                </div>

                                {!item.is_new && (
                                  <span className="text-[10px] text-violet-500 flex items-center gap-1 px-3 pb-2 -mt-1">
                                    <Eye className="h-2.5 w-2.5" />
                                    ya la tenías
                                  </span>
                                )}

                                {isOpen && (
                                  <div className="px-3 pb-2.5 pt-2 space-y-1.5 border-t border-border/40">
                                    {sense && (
                                      <p className="text-[11px] leading-relaxed">
                                        {sense}
                                      </p>
                                    )}
                                    {item.meaning &&
                                      item.meaning_es &&
                                      item.meaning !== item.meaning_es && (
                                        <p className="text-[11px] leading-relaxed text-muted-foreground italic">
                                          {item.meaning}
                                        </p>
                                      )}
                                    {item.context && (
                                      <p className="text-[11px] text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                                        “{item.context}”
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        onConfirm={onDiscard}
        title="¿Descartar la sesión?"
        description="Se borra el tiempo registrado. Las expresiones que guardaste se mantienen en tu diccionario."
        confirmText="Descartar"
      />
    </div>
  );
}
