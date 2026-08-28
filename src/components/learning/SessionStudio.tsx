import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Pencil,
  ExternalLink,
} from "lucide-react";
import { YouTubePlayer, type YouTubePlayerHandle, type VideoMeta } from "./YouTubePlayer";
import { SubtitleTrack } from "./SubtitleTrack";
import { SubtitleCaption } from "./SubtitleCaption";
import { TranscriptActions } from "./TranscriptActions";
import { VideoActionsPanel, type StudioState } from "./VideoActionsPanel";
import { TranscriptHelpDialog } from "./TranscriptHelpDialog";
import { PlayerTransport } from "./PlayerTransport";
import { WordLookup } from "./WordLookup";
import type { WordMark } from "./DockLine";
import {
  detectItemType,
  formatClock,
  formatDuration,
  youTubeWatchUrl,
  type ItemType,
} from "@/lib/learning-config";
import {
  activeCueIndex,
  groupCues,
  normalizeLookup,
  type Cue,
} from "@/lib/transcript";
import { bandOf, effectiveRank, lemmatize } from "@/lib/corpus";
import { difficultyTrack } from "@/lib/heat";
import { useTranscript } from "@/hooks/useTranscript";
import { useFrequencyList } from "@/hooks/useFrequencyList";
import { useActiveSpot, type PlaybackSample } from "@/hooks/useSmoothPosition";
import type { LearningSession } from "@/hooks/useLearningSessions";
import { useLearningItems, useSessionItems } from "@/hooks/useLearningItems";
import { useResetLearningContent } from "@/hooks/useLearningSessions";
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
 * Acá está la palanca de toda esta pantalla: el video crece a lo ancho solo si
 * le sobra alto, así que cada fila que se saca de encima o debajo se convierte
 * en video. Lo que queda descontado es lo mínimo —el espacio de la app y la
 * pista de subtítulos—; los controles ya no cuestan nada porque viven dentro
 * del marco.
 */
/**
 * A cuántos píxeles del pie del video la barra se vuelve barra.
 *
 * Poco: unos pocos píxeles por encima de la línea, lo justo para no obligarte
 * a apuntar. Con un margen grande se despertaba sola mientras leías el
 * subtítulo, que ocupa la parte de abajo del cuadro.
 */
const BAR_REACH = 20;

const VIDEO_MAX_WIDTH = "calc((100vh - 18rem) * 16 / 9)";

/** El subtítulo sobre el video: encendido salvo que lo hayas apagado tú. */
const CAPTION_PREF_KEY = "rindo:learning-caption";

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

  /**
   * El subtítulo sobre el video se puede apagar, y la elección queda hecha:
   * es una preferencia de cómo miras, no algo que quieras volver a decidir
   * cada vez que abres un video.
   */
  const [captionOn, setCaptionOn] = useState(
    () => localStorage.getItem(CAPTION_PREF_KEY) !== "0"
  );

  const toggleCaption = useCallback(() => {
    setCaptionOn((prev) => {
      localStorage.setItem(CAPTION_PREF_KEY, prev ? "0" : "1");
      return !prev;
    });
    onActivity();
  }, [onActivity]);
  const [transcriptHelpOpen, setTranscriptHelpOpen] = useState(false);

  /**
   * La transcripción completa, a un clic y no permanente.
   *
   * Leer se lee sobre el video. Lo que la lista sigue sirviendo es para
   * volver: "¿dónde dijo eso?". Eso pasa un par de veces por sesión y no vale
   * un tercio de la pantalla todo el rato, así que se abre cuando la buscas.
   */
  const [transcriptOpen, setTranscriptOpen] = useState(false);

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

  /**
   * Lo que se lee no son las líneas de tiempo: son bloques.
   *
   * Los cues de YouTube se cortan cada dos segundos sin mirar dónde —en esta
   * biblioteca, hasta el 79% termina a media frase— así que como unidad de
   * lectura no sirven. `groupCues` los cose en bloques eligiendo dónde cortar,
   * y cada trozo conserva su segundo para el barrido y para el salto.
   */
  const blocks = useMemo(() => groupCues(cues), [cues]);

  /**
   * Dónde va la voz, hasta la palabra. Lo calcula una sola vez para los dos
   * lugares que la muestran: el subtítulo sobre el video y la transcripción.
   */
  const spot = useActiveSpot(playbackRef, blocks, trackDuration);

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
  /** "Repetir frase" ahora repite la frase, no la tajada de dos segundos. */
  const repeatLine = useCallback(() => {
    if (!blocks.length) return;
    const now = playerRef.current?.getCurrentTime() ?? 0;
    let index = activeCueIndex(blocks, now);
    if (index < 0) index = 0;
    if (index > 0 && now - blocks[index].t < 0.6) index -= 1;

    playerRef.current?.seekTo(blocks[index].t);
    playerRef.current?.play();
    onActivity();
  }, [blocks, onActivity]);

  // ── Formulario de captura ─────────────────────────────────

  const [isCapturing, setIsCapturing] = useState(false);

  /**
   * Si la expresión se está escribiendo.
   *
   * Cuando llega de tocar una palabra ya está resuelta: mostrarla dentro de un
   * campo de texto invita a corregir algo que nadie quiere corregir, y empuja
   * la respuesta hacia abajo. El campo aparece cuando la escribes tú, o cuando
   * pides corregirla.
   */
  const [editingTerm, setEditingTerm] = useState(false);
  const [expression, setExpression] = useState("");
  const [context, setContext] = useState("");
  const [meaning, setMeaning] = useState("");
  const [translation, setTranslation] = useState<string | null>(null);
  const [itemType, setItemType] = useState<ItemType>("expression");
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
    setEditingTerm(true);
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
      setAlreadySaved(!lookup && auto.enabled);
      setLookupOnly(lookup);
      setEditingTerm(false);
      setIsCapturing(true);
      if (!lookup) onActivity();
    },
    [isPaused, onActivity, holdVideo, auto]
  );

  const closeCapture = useCallback((resumeVideo: boolean) => {
    setIsCapturing(false);
    setEditingTerm(false);
    setExpression("");
    setContext("");
    setMeaning("");
    setTranslation(null);
    setItemType("expression");
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

  /**
   * El tipo se deduce del largo de la expresión y no se pregunta.
   *
   * Había una fila de chips para elegirlo, debajo de todo lo demás: cuatro
   * botones que hay que leer y decidir cada vez que guardas una palabra, para
   * un dato que se adivina solo mirando cuántas palabras tiene.
   */
  useEffect(() => {
    if (!isCapturing) return;
    setItemType(detectItemType(expression));
  }, [expression, isCapturing]);

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
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        toggleCaption();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openCapture, hasPlayer, onActivity, repeatLine, toggleCaption]);

  // ── Estado visual ─────────────────────────────────────────

  const state: StudioState = isPaused
    ? "paused"
    : isVideoPlaying || !hasPlayer
      ? "studying"
      : "researching";

  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const resetContent = useResetLearningContent();

  /**
   * Si la mano está sobre la barra de progreso. Nada más se levanta con eso:
   * leyendo el subtítulo uno está dentro del cuadro todo el rato, y que el
   * reproductor reaccione a eso es pedir atención justo cuando estás en otra
   * cosa. Solo la barra, y solo cuando la mano está encima.
   */
  const [nearBar, setNearBar] = useState(false);

  return (
    <div className={cn("flex flex-col", STUDIO_HEIGHT)} onPointerDown={onActivity}>
      {/* ── Reproductor y frase (izquierda) · captura (derecha) ── */}
      {/*
        Flex y no grid, y con un ancho normal y no uno arbitrario: la columna de
        la derecha es una lista de acciones, no contenido, así que mide lo que
        mide y el resto se lo lleva el video. En una fila con `min-w-0` el video
        no puede desbordar por ancho que pida; bajo el breakpoint la fila se
        vuelve columna y la barra pasa a ser el pie de la página.
      */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        {/* Columna del video */}
        {hasPlayer ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            {/*
              Dos bloques y nada más: el marco del video —con sus controles
              adentro— y la pista de subtítulos. Todo lo que antes vivía en
              filas propias arriba y abajo se mudó al marco o a la columna de
              la derecha, y ese alto es exactamente el que ganó el video.
            */}
            <div
              className="mx-auto flex min-h-0 w-full flex-1 flex-col justify-center gap-2"
              style={{ maxWidth: VIDEO_MAX_WIDTH }}
            >
              <div
                onPointerMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setNearBar(rect.bottom - event.clientY <= BAR_REACH);
                }}
                onPointerLeave={() => setNearBar(false)}
                className="group relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-black"
              >
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
                      // Tocar una palabra también pausa, pero eso no fue "parar
                      // el video": fue preguntar. El play gigante encima de la
                      // cara convierte una consulta en una interrupción, así
                      // que mientras hay una ficha abierta no aparece.
                      isVideoPlaying || isCapturing
                        ? "scale-90 opacity-0"
                        : "scale-100 opacity-100"
                    )}
                  >
                    <Play className="h-7 w-7 translate-x-[2px] fill-current" />
                  </span>
                </button>

                <SubtitleCaption
                  block={
                    captionOn && spot.block >= 0 ? blocks[spot.block] : null
                  }
                  word={spot.word}
                  onPick={pickFromTranscript}
                  markOf={markOf}
                  lifted={!isVideoPlaying}
                />

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
                  near={nearBar}
                />
              </div>

              {/*
                Lo que capturas, justo debajo del video.

                Antes vivía en la columna angosta de la derecha, a un metro de
                la palabra que lo dispara. Ahora la palabra que tocas y la ficha
                que aparece están una encima de la otra, en la misma columna: el
                ojo baja diez centímetros y ya está: por eso tocar una palabra
                se lee como preguntar y no como que se abrió otra cosa en otra
                parte de la pantalla.

                Y el ancho no se desperdicia: a la izquierda lo que preguntas,
                a la derecha lo que llevas juntado, siempre a la vista.
              */}
              <div
                className={cn(
                  "rounded-2xl border border-border/60 bg-card flex flex-col overflow-hidden",
                  "min-h-0 h-[13rem] shrink-0 lg:h-auto lg:min-h-[9rem] lg:flex-1"
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
                  className="flex-1 min-h-0 overflow-hidden p-3"
                  onTouchMove={(e) => e.stopPropagation()}
                >
                  <div className="flex h-full min-h-0 gap-3 lg:gap-5">
                    {isCapturing ? (
                      <>
                        {/* La respuesta */}
                        <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                          {editingTerm && (
                            <Input
                              ref={expressionRef}
                              value={expression}
                              onChange={(e) => setExpression(e.target.value)}
                              onBlur={() =>
                                expression.trim() && setEditingTerm(false)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  setEditingTerm(false);
                                  if (!lookupOnly && expression.trim())
                                    submitCapture();
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  closeCapture(true);
                                }
                              }}
                              placeholder="come across"
                              className="h-9 shrink-0 rounded-xl font-medium"
                            />
                          )}

                          {expression.trim().length > 1 ? (
                            <WordLookup
                              compact
                              term={expression}
                              contextSentence={context}
                              onUseDefinition={setMeaning}
                              onTranslation={setTranslation}
                              className="min-h-0 flex-1"
                            />
                          ) : (
                            <p className="text-[13px] text-muted-foreground">
                              Escribe la expresión que quieres guardar.
                            </p>
                          )}
                        </div>

                        {/*
                          La salida, siempre a la vista. Era lo que quedaba
                          debajo del pliegue: había que desplazarse para llegar
                          a guardar, que es justo lo que uno viene a hacer.
                        */}
                        <div className="flex w-[9.5rem] shrink-0 flex-col justify-center gap-2 border-l border-border/50 pl-3 lg:pl-4">
                          {lookupOnly ? (
                            <>
                              <p className="text-[10px] leading-snug text-muted-foreground">
                                En pausa esto es solo para mirar.
                              </p>
                              <Button
                                onClick={resumeAndSave}
                                disabled={!expression.trim()}
                                className="h-9 w-full rounded-xl font-semibold"
                              >
                                <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                                Reanudar
                              </Button>
                              <Button
                                onClick={() => closeCapture(true)}
                                variant="ghost"
                                className="h-8 w-full rounded-xl text-xs"
                              >
                                Cerrar
                              </Button>
                            </>
                          ) : alreadySaved ? (
                            <>
                              <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500">
                                <Check className="h-3.5 w-3.5" />
                                Guardada
                              </span>
                              <Button
                                onClick={() => closeCapture(true)}
                                className="h-9 w-full rounded-xl font-semibold"
                              >
                                <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                                Seguir
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                onClick={submitCapture}
                                disabled={!expression.trim()}
                                className="h-9 w-full rounded-xl font-semibold"
                              >
                                Guardar
                                <kbd className="ml-2 rounded bg-black/15 px-1 text-[10px] font-mono">
                                  ⏎
                                </kbd>
                              </Button>
                              <div className="flex gap-1.5">
                                <Button
                                  onClick={() => {
                                    setEditingTerm((v) => !v);
                                    requestAnimationFrame(() =>
                                      expressionRef.current?.focus()
                                    );
                                  }}
                                  variant="ghost"
                                  title="Corregir la expresión"
                                  className="h-8 flex-1 rounded-xl px-0 text-xs"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  onClick={() => closeCapture(true)}
                                  variant="ghost"
                                  className="h-8 flex-1 rounded-xl text-xs"
                                >
                                  Cerrar
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Cómo se pregunta */}
                        <div className="flex w-[13rem] shrink-0 flex-col justify-center gap-2">
                          <Button
                            onClick={openCapture}
                            variant="outline"
                            className="h-9 w-full rounded-xl border-dashed font-medium"
                          >
                            {isPaused ? (
                              <Search className="mr-2 h-4 w-4" />
                            ) : (
                              <Plus className="mr-2 h-4 w-4" />
                            )}
                            {isPaused ? "Buscar una palabra" : "Nueva expresión"}
                            <kbd className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                              E
                            </kbd>
                          </Button>
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            O toca cualquier palabra del subtítulo: el video se
                            detiene solo y su significado aparece acá.
                          </p>
                        </div>

                        {/*
                          Lo que llevas juntado. Vive solo en este momento —
                          cuando no hay nada que preguntar— porque compitiendo
                          con la respuesta le robaba el espacio a lo que sí
                          importa. Cada una vuelve a su minuto al tocarla.
                        */}
                        <div className="min-w-0 flex-1 overflow-y-auto border-l border-border/50 pl-3 lg:pl-4">
                          {captured.length === 0 ? (
                            <p className="flex h-full items-center text-[11px] text-muted-foreground">
                              Todavía no has guardado nada en esta sesión.
                            </p>
                          ) : (
                            <div className="flex flex-wrap content-start gap-1.5">
                              {captured
                                .slice()
                                .reverse()
                                .map((item) => (
                                  <button
                                    key={item.sighting_id}
                                    onClick={() => {
                                      if (item.timestamp_seconds === null) return;
                                      playerRef.current?.seekTo(
                                        item.timestamp_seconds
                                      );
                                      onActivity();
                                    }}
                                    title={
                                      item.timestamp_seconds !== null
                                        ? `Volver a ${formatClock(item.timestamp_seconds)}`
                                        : undefined
                                    }
                                    className={cn(
                                      "flex max-w-[15rem] items-baseline gap-1.5 rounded-lg border px-2 py-1",
                                      "border-border/50 bg-muted/20 transition-colors",
                                      "hover:border-border hover:bg-muted/40",
                                      item.pending && "opacity-60"
                                    )}
                                  >
                                    <span className="truncate text-xs font-medium">
                                      {item.expression}
                                    </span>
                                    {item.translation_es && (
                                      <span className="truncate text-[11px] text-primary">
                                        {item.translation_es}
                                      </span>
                                    )}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1 rounded-2xl border border-border/60 bg-muted/20 p-8 text-center">
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

        {/* Columna derecha: la sesión y los subtítulos */}
        <aside
          className={cn(
            "flex w-full shrink-0 flex-col gap-3",
            // Si la ventana es baja, la columna se desplaza en vez de empujar
            // el video: el video manda el alto de esta pantalla.
            "lg:w-60 lg:min-h-0 lg:overflow-y-auto xl:w-64"
          )}
        >
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
            onReset={() => setConfirmReset(true)}
            canReset={!!session.external_id}
            youtubeUrl={
              session.external_id
                ? youTubeWatchUrl(session.external_id, positionSeconds)
                : null
            }
          />

          {hasPlayer && (
            <TranscriptActions
              cueCount={cues.length}
              follow={followSubtitles}
              onFollowChange={setFollowSubtitles}
              onBring={() => setTranscriptHelpOpen(true)}
              onDelete={() => removeTranscript.mutate()}
              onOpenText={() => setTranscriptOpen(true)}
            />
          )}
        </aside>
      </div>

      <Dialog open={transcriptOpen} onOpenChange={setTranscriptOpen}>
        <DialogContent className="max-w-3xl p-0 gap-0">
          <DialogHeader className="px-4 pb-2 pt-4">
            <DialogTitle className="text-sm">
              {session.content_title ?? "La transcripción"}
            </DialogTitle>
          </DialogHeader>

          <SubtitleTrack
            blocks={blocks}
            active={spot}
            follow={followSubtitles}
            onFollowChange={setFollowSubtitles}
            onPick={(term, cue) => {
              // Preguntaste desde acá: la ficha aparece bajo el video, así que
              // esto se cierra solo —si no, tapa la respuesta que pediste.
              setTranscriptOpen(false);
              pickFromTranscript(term, cue);
            }}
            onSeek={(seconds) => {
              playerRef.current?.seekTo(seconds);
              setTranscriptOpen(false);
              onActivity();
            }}
            markOf={markOf}
            onBringSubtitles={() => setTranscriptHelpOpen(true)}
            onPasteClipboard={pasteTranscript}
            isSaving={saveTranscript.isPending}
            className="h-[65vh] border-0 rounded-none rounded-b-lg"
          />
        </DialogContent>
      </Dialog>

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

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        onConfirm={() =>
          session.external_id &&
          resetContent.mutate({
            goalId: session.goal_id,
            externalId: session.external_id,
          })
        }
        title="¿Reiniciar este video?"
        description="Queda como si nunca lo hubieras visto y vuelve a Para ver después. Se borra su tiempo y las expresiones que solo salieron acá."
        confirmText="Reiniciar"
      />
    </div>
  );
}
