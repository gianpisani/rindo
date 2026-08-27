import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ConfirmDialog from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Play,
  Plus,
  Highlighter,
  Zap,
  Check,
  Eye,
  Search,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { YouTubePlayer, type YouTubePlayerHandle, type VideoMeta } from "./YouTubePlayer";
import { SubtitleTrack } from "./SubtitleTrack";
import { TranscriptActions } from "./TranscriptActions";
import { VideoActionsPanel, type StudioState } from "./VideoActionsPanel";
import { TranscriptHelpDialog } from "./TranscriptHelpDialog";
import { PlayerTransport } from "./PlayerTransport";
import { WordLookup } from "./WordLookup";
import type { WordMark } from "./DockLine";
import {
  CAPTURE_TYPES,
  detectItemType,
  formatClock,
  formatDuration,
  youTubeWatchUrl,
  type ItemType,
} from "@/lib/learning-config";
import { activeCueIndex, normalizeLookup, type Cue } from "@/lib/transcript";
import { bandOf, effectiveRank, lemmatize } from "@/lib/corpus";
import { difficultyTrack } from "@/lib/heat";
import { useTranscript } from "@/hooks/useTranscript";
import { useFrequencyList } from "@/hooks/useFrequencyList";
import type { PlaybackSample } from "@/hooks/useSmoothPosition";
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
 * Tope de ancho del video, que en realidad es un tope de alto.
 *
 * Casi siempre manda el ancho de la columna —el video ocupa los tres cuartos
 * de la pantalla— y este cálculo no llega a aplicar. Solo entra en ventanas
 * bajas, donde impide que el video empuje a los subtítulos fuera de vista:
 * descuenta los controles, la pista y el espacio de la app, y el que cede es
 * el video.
 */
const VIDEO_MAX_WIDTH = "calc((100vh - 21rem) * 16 / 9)";

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

  const { items, capture, updateItem } = useLearningItems(session.goal_id);
  const { data: captured = [] } = useSessionItems(session.id);

  const auto = useAutoCapture({
    goalId: session.goal_id,
    sessionId: session.id,
    capture,
    updateItem,
  });

  const hasPlayer = session.content_type === "youtube" && !!session.external_id;

  const [positionSeconds, setPositionSeconds] = useState(startSeconds);

  /**
   * La última posición informada, con la hora exacta en que llegó. Vive en una
   * `ref` para que la frase grande y la barra puedan interpolar cuadro a cuadro
   * sin repintar el estudio entero sesenta veces por segundo.
   */
  const playbackRef = useRef<PlaybackSample>({
    seconds: startSeconds,
    playing: false,
    at: performance.now(),
  });

  const handlePlayback = useCallback(
    (seconds: number, playing: boolean) => {
      playbackRef.current = { seconds, playing, at: performance.now() };
      setPositionSeconds(Math.floor(seconds));
      onPlayback(seconds, playing);
    },
    [onPlayback]
  );

  /** El largo del video: lo dice el player apenas está listo. */
  const [duration, setDuration] = useState(
    session.content_duration_seconds ?? 0
  );

  const handleMeta = useCallback(
    (meta: VideoMeta) => {
      if (meta.durationSeconds) setDuration(meta.durationSeconds);
      onMeta(meta);
    },
    [onMeta]
  );

  // ── Lo que sabemos del texto ──────────────────────────────

  const { transcript, save: saveTranscript, remove: removeTranscript } =
    useTranscript(session.external_id);
  const cues = useMemo(() => transcript?.cues ?? [], [transcript]);

  /** La pista de subtítulos va detrás del video hasta que la muevas tú. */
  const [followSubtitles, setFollowSubtitles] = useState(true);
  const [transcriptHelpOpen, setTranscriptHelpOpen] = useState(false);

  const pasteTranscript = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.error("El portapapeles está vacío");
        return;
      }
      saveTranscript.mutate(text, {
        onSuccess: () => setTranscriptHelpOpen(false),
      });
    } catch {
      toast.error("No pude leer el portapapeles", {
        description: "Ábrelo con «Traer subtítulos» y pégalos ahí.",
      });
      setTranscriptHelpOpen(true);
    }
  }, [saveTranscript]);
  const { frequency, isReady: rankReady } = useFrequencyList();

  /** Todo tu diccionario, para reconocer una palabra tuya en el aire. */
  const known = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      const expression = normalizeLookup(item.expression);
      if (expression) set.add(expression);
    }
    return set;
  }, [items]);

  /**
   * Qué se le marca a cada palabra de la frase.
   *
   * Solo dos cosas, y las dos accionables: que ya la cazaste antes —verla
   * aparecer en la calle es media mitad de aprenderla— o que está por sobre las
   * tres mil más usadas, el corte donde uno deja de seguir un podcast sin
   * esfuerzo. Los nombres propios y las erratas no se marcan: que digan
   * "Copenhague" no es vocabulario que te falte.
   */
  const markOf = useCallback(
    (word: string): WordMark | null => {
      const clean = normalizeLookup(word);
      if (!clean) return null;

      if (
        known.has(clean) ||
        (rankReady && known.has(lemmatize(clean, frequency.rank)))
      ) {
        return {
          color: "var(--primary)",
          solid: true,
          title: "Ya está en tu diccionario",
        };
      }

      if (!rankReady) return null;

      const band = bandOf(effectiveRank(clean, frequency.rank));
      if (band.key === "core" || band.key === "common" || band.key === "off") {
        return null;
      }

      return {
        color: band.color,
        title: `${band.label} · ${band.hint} del inglés hablado`,
      };
    },
    [known, frequency, rankReady]
  );

  /** El largo que usa la barra: el del player, o el último subtítulo. */
  const trackDuration =
    duration || (cues.length ? cues[cues.length - 1].t + 5 : 0);

  /** Los hitos de la barra: dónde te frenaste a guardar algo. */
  const captureMarkers = useMemo(
    () =>
      captured
        .map((item) => item.timestamp_seconds)
        .filter((at): at is number => at !== null),
    [captured]
  );

  /** El relieve del video: dónde se pone difícil. */
  const heat = useMemo(
    () =>
      rankReady ? difficultyTrack(cues, trackDuration, frequency.rank) : [],
    [cues, trackDuration, frequency, rankReady]
  );

  /**
   * Volver al principio de la frase que suena.
   *
   * Si recién empezó, se repite la anterior: apretar "repetir" en el primer
   * medio segundo de una línea siempre quiere decir "esa que no alcancé a oír".
   */
  const repeatLine = useCallback(() => {
    if (!cues.length) return;
    const now = playerRef.current?.getCurrentTime() ?? 0;
    let index = activeCueIndex(cues, now);
    if (index < 0) index = 0;
    if (index > 0 && now - cues[index].t < 0.6) index -= 1;

    playerRef.current?.seekTo(cues[index].t);
    playerRef.current?.play();
    onActivity();
  }, [cues, onActivity]);

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
  /**
   * Modo consulta: con la sesión pausada las palabras igual se pueden mirar.
   * Buscar qué significa algo no es tiempo de estudio, pero tampoco es motivo
   * para no dejarte mirar — así que se ve la ficha completa y no se guarda nada.
   */
  const [lookupOnly, setLookupOnly] = useState(false);
  const capturedAtRef = useRef<number | null>(null);
  const wasPlayingRef = useRef(false);

  const holdVideo = useCallback(() => {
    wasPlayingRef.current = playerRef.current?.isPlaying() ?? false;
    if (wasPlayingRef.current) playerRef.current?.pause();
  }, []);

  const openCapture = useCallback(() => {
    holdVideo();
    capturedAtRef.current = hasPlayer
      ? Math.round(playerRef.current?.getCurrentTime() ?? 0)
      : null;
    setAlreadySaved(false);
    setLookupOnly(isPaused);
    setIsCapturing(true);
    if (!isPaused) onActivity();
    requestAnimationFrame(() => expressionRef.current?.focus());
  }, [hasPlayer, isPaused, onActivity, holdVideo]);

  const pickFromTranscript = useCallback(
    (term: string, cue: Cue) => {
      holdVideo();

      // En pausa la ficha se ve igual, pero no se guarda ni se registra
      // actividad: es una consulta, no una captura.
      const lookup = isPaused;

      // En automático la ficha se ve igual; lo único que cambia es que ya
      // quedó guardada y no hay que apretar nada.
      if (!lookup && auto.enabled) auto.captureNow(term, cue.text, cue.t);

      capturedAtRef.current = cue.t;
      setExpression(term);
      setContext(cue.text);
      setMeaning("");
      setTranslation(null);
      setItemType(detectItemType(term));
      setTypeTouched(false);
      setAlreadySaved(!lookup && auto.enabled);
      setLookupOnly(lookup);
      setIsCapturing(true);
      if (!lookup) onActivity();
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
    setLookupOnly(false);
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

  /**
   * Lo que encontraste mirando en pausa no se pierde: reanuda la sesión y lo
   * guarda, que es lo que ibas a hacer a mano de todas formas.
   */
  const resumeAndSave = useCallback(() => {
    onResume();
    setLookupOnly(false);
    submitCapture();
  }, [onResume, submitCapture]);

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
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        repeatLine();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openCapture, hasPlayer, onActivity, repeatLine]);

  // ── Estado visual ─────────────────────────────────────────

  const state: StudioState = isPaused
    ? "paused"
    : isVideoPlaying || !hasPlayer
      ? "studying"
      : "researching";

  const [confirmDiscard, setConfirmDiscard] = useState(false);

  /**
   * Cuál de las expresiones capturadas está abierta. Solo una a la vez: la
   * lista vive en una columna angosta y dos fichas abiertas la vuelven ilegible.
   */
  const [openItem, setOpenItem] = useState<string | null>(null);

  return (
    <div className={cn("flex flex-col", STUDIO_HEIGHT)} onPointerDown={onActivity}>
      {/* ── Reproductor y frase (izquierda) · captura (derecha) ── */}
      <div
        className={cn(
          "flex-1 min-h-0 grid gap-3",
          hasPlayer ? "lg:grid-cols-12" : "lg:grid-cols-1"
        )}
      >
        {/* Columna del video */}
        {hasPlayer ? (
          <div className="flex min-h-0 min-w-0 flex-col gap-2 lg:col-span-9">
            {/*
              El video, los controles y la pista de subtítulos son una sola
              pieza y comparten ancho. Sin la franja de estado encima, el video
              se estira hasta donde da la columna y lo que sobra de alto se lo
              queda la pista: nada de aire muerto entre medio.
            */}
            <div
              className="mx-auto flex min-h-0 w-full flex-1 flex-col justify-center gap-2"
              style={{ maxWidth: VIDEO_MAX_WIDTH }}
            >
              <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-black">
                <YouTubePlayer
                  ref={playerRef}
                  videoId={session.external_id!}
                  startSeconds={startSeconds}
                  onMeta={handleMeta}
                  onPlayback={handlePlayback}
                  chromeless
                  className="h-full w-full"
                />

                {/*
                  Nuestra capa sobre el iframe. Se come el hover y el clic, así
                  que YouTube no alcanza a mostrar su título, sus botones ni sus
                  sugeridos: el video se ve, el resto es de Rindo.
                */}
                <button
                  onClick={() => {
                    playerRef.current?.toggle();
                    onActivity();
                  }}
                  aria-label={isVideoPlaying ? "Pausar el video" : "Reproducir"}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span
                    className={cn(
                      "flex size-16 items-center justify-center rounded-full",
                      "bg-black/55 text-white backdrop-blur-sm transition-all duration-200",
                      isVideoPlaying
                        ? "scale-90 opacity-0"
                        : "scale-100 opacity-100"
                    )}
                  >
                    <Play className="h-7 w-7 translate-x-[2px] fill-current" />
                  </span>
                </button>
              </div>

              <PlayerTransport
                playbackRef={playbackRef}
                playing={isVideoPlaying}
                durationSeconds={trackDuration}
                cues={cues}
                heat={heat}
                markers={captureMarkers}
                onSeek={(seconds) => {
                  playerRef.current?.seekTo(seconds);
                  onActivity();
                }}
                onSeekBy={(seconds) => {
                  playerRef.current?.seekBy(seconds);
                  onActivity();
                }}
                onToggle={() => {
                  playerRef.current?.toggle();
                  onActivity();
                }}
                onRepeatLine={repeatLine}
                youtubeUrl={
                  session.external_id
                    ? youTubeWatchUrl(session.external_id, positionSeconds)
                    : null
                }
              />

              <SubtitleTrack
                cues={cues}
                playbackRef={playbackRef}
                follow={followSubtitles}
                onFollowChange={setFollowSubtitles}
                onPick={pickFromTranscript}
                onSeek={(seconds) => {
                  playerRef.current?.seekTo(seconds);
                  onActivity();
                }}
                markOf={markOf}
                onBringSubtitles={() => setTranscriptHelpOpen(true)}
                onPasteClipboard={pasteTranscript}
                isSaving={saveTranscript.isPending}
                className="h-[9rem] shrink-0 lg:h-auto lg:min-h-[9rem] lg:max-h-[20rem] lg:flex-1"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-8 text-center">
            <p className="text-sm font-medium">{session.content_title}</p>
            <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto">
              Este contenido se reproduce fuera de Rindo. El cronómetro de al
              lado mide tu tiempo de estudio igual.
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

        {/* Columna derecha: la sesión, los subtítulos y lo que capturas */}
        <div className="flex flex-col gap-3 min-h-0 min-w-0 lg:col-span-3">
          <VideoActionsPanel
            state={state}
            title={session.content_title}
            author={session.content_author}
            effectiveSeconds={liveEffectiveSeconds}
            elapsedSeconds={liveElapsedSeconds}
            isPaused={isPaused}
            onPause={onPause}
            onResume={onResume}
            onFinish={onFinish}
            onLeave={onLeave}
            onDiscard={() => setConfirmDiscard(true)}
          />

          {hasPlayer && (
            <TranscriptActions
              cueCount={cues.length}
              follow={followSubtitles}
              onFollowChange={setFollowSubtitles}
              onBring={() => setTranscriptHelpOpen(true)}
              onDelete={() => removeTranscript.mutate()}
            />
          )}

          <div
            className={cn(
              "rounded-2xl border border-border/60 bg-card flex flex-col overflow-hidden",
              "flex-1 min-h-0 max-h-[60vh] lg:max-h-full"
            )}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Highlighter className="h-3.5 w-3.5 text-primary shrink-0" />
                <h3 className="text-xs font-semibold shrink-0">
                  {lookupOnly ? "Consultar" : "Capturar"}
                </h3>
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
                        if (!lookupOnly) submitCapture();
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
                        if (!lookupOnly) submitCapture();
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

                  <div
                    className={cn(
                      "flex flex-wrap gap-1.5",
                      (alreadySaved || lookupOnly) && "hidden"
                    )}
                  >
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

                  {lookupOnly ? (
                    <div className="space-y-2 pt-0.5">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        La sesión está pausada: esto es solo para mirar — no se
                        guarda ni suma tiempo.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={resumeAndSave}
                          disabled={!expression.trim()}
                          variant="outline"
                          className="flex-1 rounded-xl h-9 font-semibold border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                        >
                          <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                          Reanudar y guardar
                        </Button>
                        <Button
                          onClick={() => closeCapture(true)}
                          variant="ghost"
                          className="rounded-xl h-9"
                        >
                          Cerrar
                        </Button>
                      </div>
                    </div>
                  ) : alreadySaved ? (
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
                    variant="outline"
                    className="w-full rounded-xl h-10 border-dashed font-medium"
                  >
                    {isPaused ? (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Buscar una palabra
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Nueva expresión
                      </>
                    )}
                    <kbd className="ml-2 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">
                      E
                    </kbd>
                  </Button>

                  <div className="mt-3">
                    {captured.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground text-center py-4 px-1 leading-relaxed">
                        {isPaused
                          ? "En pausa puedes mirar cualquier palabra de los subtítulos: se ve su significado, pero no se guarda hasta que reanudes."
                          : "Haz clic en cualquier palabra de los subtítulos. El video se pausa solo y vuelve a andar al guardar."}
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

      {session.external_id && (
        <TranscriptHelpDialog
          open={transcriptHelpOpen}
          onOpenChange={setTranscriptHelpOpen}
          externalId={session.external_id}
          onPasteFromClipboard={pasteTranscript}
        />
      )}

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
