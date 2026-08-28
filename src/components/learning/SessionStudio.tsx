import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ExternalLink, Highlighter, HelpCircle, MoreHorizontal, Play, Plus } from "lucide-react";
import { YouTubePlayer, type YouTubePlayerHandle, type VideoMeta } from "./YouTubePlayer";
import { SubtitleTrack } from "./SubtitleTrack";
import { SubtitleCaption } from "./SubtitleCaption";
import { TranscriptHelpDialog } from "./TranscriptHelpDialog";
import { PlayerTransport } from "./PlayerTransport";
import { CaptureSheet } from "./CaptureSheet";
import { StudioShortcutsDialog } from "./StudioShortcutsDialog";
import {
  RailButton,
  StudioControlRail,
  StudioTopRail,
  type StudioPanel,
  type StudioState,
} from "./StudioChrome";
import {
  CapturedPanel,
  SessionPanel,
  SubtitlesPanel,
} from "./StudioPanels";
import type { WordMark } from "./DockLine";
import {
  detectItemType,
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
 * El alto que la sala se reserva fuera de la imagen: la barra de arriba, la
 * franja donde vive la barra de progreso y la barra de abajo.
 *
 * Acá está la palanca de toda esta pantalla. El video crece a lo ancho solo si
 * le sobra alto, así que cada rem que no se reserva se convierte en imagen.
 * Antes lo descontado eran dieciocho rem —una columna de tarjetas y un panel de
 * captura, permanentes los dos—; ahora son menos de nueve, y son dos barras que
 * se van solas cuando dejas de mover la mano.
 */
const RESERVED_HEIGHT = "8.75rem";

/**
 * El ancho de la pantalla: lo que quepa a lo ancho, o lo que el alto permita a
 * dieciséis novenos. Manda el más chico de los dos, y la imagen no se recorta
 * nunca: lo que sobra queda en negro arriba y abajo, como en el cine.
 */
const SCREEN_WIDTH = `min(calc(100vw - 1.5rem), calc((100dvh - ${RESERVED_HEIGHT}) * 16 / 9))`;

/**
 * Cuánto aguanta el cromo antes de irse.
 *
 * Y de dónde vuelve: de fuera del cuadro. Dentro del cuadro la mano está
 * leyendo —o yendo a tocar una palabra del subtítulo— y que eso levante las dos
 * barras es el reproductor pidiendo atención justo cuando estás en otra cosa.
 * Salir del cuadro, en cambio, ya es ir a buscar algo.
 */
const IDLE_MS = 2800;

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

  /** Qué panel está abierto sobre la sala. Uno solo a la vez. */
  const [panel, setPanel] = useState<StudioPanel>(null);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  /**
   * Si el cromo está a la vista.
   *
   * Las dos barras se van solas y la sala queda siendo el video y la frase. No
   * es un efecto: es la forma que toma la idea de esta pantalla —mientras
   * escuchas, nada de lo demás lo estás usando— sin que eso te cueste tener que
   * pedirlo cada vez.
   */
  const [chromeOn, setChromeOn] = useState(true);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Si la mano está dentro del cuadro. Ahí moverse no despierta nada. */
  const insideScreen = useRef(false);

  const wake = useCallback(() => {
    setChromeOn(true);
    if (idleRef.current) clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => setChromeOn(false), IDLE_MS);
  }, []);

  /** Moverse: despierta solo si fue fuera del cuadro. */
  const wakeOutsideScreen = useCallback(() => {
    if (insideScreen.current) return;
    wake();
  }, [wake]);

  useEffect(() => {
    wake();
    return () => {
      if (idleRef.current) clearTimeout(idleRef.current);
    };
  }, [wake]);

  /**
   * El cromo no se esconde si hace falta: con el video detenido, con la ficha
   * abierta o con un panel abierto, lo que estás haciendo ES el cromo.
   */
  const chromeVisible =
    chromeOn || !isVideoPlaying || isCapturing || panel !== null;

  /**
   * Entrar al estudio es bajar las luces de la casa.
   *
   * La clase va en el `body` y no en el `html` a propósito: los temas a medida
   * escriben las variables como estilo en línea sobre el `html`, y un estilo en
   * línea le gana a cualquier clase del mismo elemento. Declaradas un nivel más
   * abajo, ganan las nuestras —y de paso alcanzan a los diálogos, que se montan
   * en el `body` y quedarían claros sobre una sala negra.
   */
  useEffect(() => {
    const body = document.body;
    const wasDark = body.classList.contains("dark");
    if (!wasDark) body.classList.add("dark");
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      if (!wasDark) body.classList.remove("dark");
      body.style.overflow = previousOverflow;
    };
  }, []);

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

      // Cualquier tecla también despierta el cromo: si estás pidiendo algo,
      // querés ver dónde caiste.
      wake();

      /**
       * Escape cierra lo de más adentro y no lo de más afuera.
       *
       * Un diálogo abierto se queda con la tecla —es suya, y la maneja Radix—;
       * si no hay ninguno, cierra el panel, después la ficha, y solo cuando no
       * queda nada abierto sale del estudio. Salir no borra nada: pausa y
       * guarda el minuto donde quedaste.
       */
      if (e.key === "Escape") {
        const dialogOpen = document.querySelector(
          '[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"]'
        );
        if (dialogOpen) return;

        e.preventDefault();
        if (panel) setPanel(null);
        else if (isCapturing) closeCapture(true);
        else onLeave();
        return;
      }

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
  }, [
    openCapture,
    hasPlayer,
    onActivity,
    repeatLine,
    toggleCaption,
    wake,
    panel,
    isCapturing,
    closeCapture,
    onLeave,
  ]);

  // ── Estado visual ─────────────────────────────────────────

  const state: StudioState = isPaused
    ? "paused"
    : isVideoPlaying || !hasPlayer
      ? "studying"
      : "researching";

  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const resetContent = useResetLearningContent();

  // ── La sala ───────────────────────────────────────────────

  /**
   * El estudio se sale de la app: pantalla completa, fondo oscuro y nada de
   * barra lateral ni cabecera.
   *
   * No es que estorbaran: es que el video estaba definido como lo que sobra
   * —el ancho lo repartían cuatro paneles permanentes— y por eso nunca podía
   * ser grande. Acá la sala es del video, y todo lo demás es una capa que
   * aparece cuando la pides y se va cuando no.
   */
  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "studio-room dark fixed inset-0 z-[60] flex h-[100dvh] flex-col",
          "overflow-hidden text-foreground"
        )}
        onPointerMove={wakeOutsideScreen}
        onPointerDown={onActivity}
      >
        {/* ── Arriba: de dónde vienes, qué ves y cuánto llevas ── */}
        <div
          className={cn(
            "z-20 shrink-0 transition-opacity duration-300",
            chromeVisible ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <StudioTopRail
            title={session.content_title}
            author={session.content_author}
            state={state}
            effectiveSeconds={liveEffectiveSeconds}
            onLeave={onLeave}
          />
        </div>

        {/* ── La pantalla ────────────────────────────────────── */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {hasPlayer ? (
            <div className="flex flex-col" style={{ width: SCREEN_WIDTH }}>
              <div
                /*
                  Dentro del cuadro la mano no pide controles.
                  Está leyendo el subtítulo, o yendo a tocar una palabra, así
                  que vive adentro: si eso levantara las barras, estarían
                  levantadas siempre. Salir del cuadro —a la franja negra o a
                  cualquiera de las dos barras— es lo único que se lee como
                  "quiero los controles".

                  Se marca con una bandera y no cortando el evento: arrastrar
                  para marcar una frase escucha el `pointermove` en la ventana,
                  y React dispara sus handlers antes de que el evento llegue
                  ahí. Un `stopPropagation` acá dejaba muerta la selección.
                */
                onPointerEnter={() => {
                  insideScreen.current = true;
                }}
                onPointerLeave={() => {
                  insideScreen.current = false;
                  wake();
                }}
                className={cn(
                  "studio-screen relative aspect-video w-full shrink-0",
                  "overflow-hidden rounded-xl bg-black"
                )}
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
                  sugeridos: el video se ve, el resto es de Rindo. Y es también
                  lo que deja que mover el mouse sobre el video despierte el
                  cromo —un iframe se traga los eventos, una capa propia no.
                */}
                <button
                  onClick={() => {
                    // Con algo abierto encima, el clic en el video es "cerrá
                    // eso": es donde uno hace clic para salir de una cosa.
                    if (panel) {
                      setPanel(null);
                      return;
                    }
                    if (isCapturing) {
                      closeCapture(true);
                      return;
                    }
                    playerRef.current?.toggle();
                    onActivity();
                  }}
                  aria-label={isVideoPlaying ? "Pausar el video" : "Reproducir"}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span
                    className={cn(
                      "flex size-20 items-center justify-center rounded-full",
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
                    <Play className="h-9 w-9 translate-x-[3px] fill-current" />
                  </span>
                </button>

                <SubtitleCaption
                  block={
                    captionOn && spot.block >= 0 ? blocks[spot.block] : null
                  }
                  word={spot.word}
                  onPick={pickFromTranscript}
                  markOf={markOf}
                  dimmed={isCapturing}
                />

                {/*
                  La penumbra.
                  Cuando preguntas, el video no se encoge: se retira. El cuadro
                  sigue detrás —es el contexto de la palabra, y con la imagen
                  congelada uno sigue sabiendo dónde está— pero deja de competir
                  con lo único que en ese momento importa, que es la respuesta.
                */}
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-0 z-20",
                    "bg-background/80 backdrop-blur-[3px] transition-opacity duration-300",
                    isCapturing ? "opacity-100" : "opacity-0"
                  )}
                />
              </div>

              {/* Dónde vas: pegada al borde de abajo, fuera de la imagen */}
              <PlayerTransport
                playbackRef={playbackRef}
                playing={isVideoPlaying}
                durationSeconds={trackDuration}
                markers={captureMarkers}
                onSeek={(seconds) => {
                  playerRef.current?.seekTo(seconds);
                  onActivity();
                }}
                className="mt-1 shrink-0"
              />
            </div>
          ) : (
            <div className="studio-glass mx-4 max-w-md rounded-2xl p-8 text-center">
              <p className="text-sm font-medium">{session.content_title}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Este contenido se reproduce fuera de Rindo. El reloj de arriba
                mide tu tiempo de estudio igual.
              </p>
              {session.content_url && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="mt-4 rounded-xl"
                >
                  <a
                    href={session.content_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Abrir
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ── Abajo: el reproductor y lo que se abre ─────────── */}
        <div
          className={cn(
            "z-20 shrink-0 transition-opacity duration-300",
            chromeVisible ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          {hasPlayer ? (
            <StudioControlRail
              playbackRef={playbackRef}
              playing={isVideoPlaying}
              durationSeconds={trackDuration}
              onToggle={() => {
                playerRef.current?.toggle();
                onActivity();
              }}
              onRepeat={repeatLine}
              captionOn={captionOn}
              onToggleCaption={toggleCaption}
              hasSubtitles={cues.length > 0}
              capturedCount={captured.length}
              onOpenCapture={openCapture}
              isPaused={isPaused}
              panel={panel}
              onPanel={setPanel}
              onHelp={() => setShortcutsOpen(true)}
            />
          ) : (
            /* Sin reproductor no hay nada que manejar: queda la sesión. */
            <div className="flex h-12 items-center justify-end gap-1 px-3 sm:px-5">
              <RailButton
                icon={<Plus className="h-4 w-4" />}
                label="Nueva expresión"
                onClick={openCapture}
                tone="outline"
              />
              <RailButton
                icon={<Highlighter className="h-4 w-4" />}
                label="Capturadas"
                onClick={() =>
                  setPanel(panel === "captured" ? null : "captured")
                }
                active={panel === "captured"}
                badge={captured.length}
              />
              <RailButton
                icon={<MoreHorizontal className="h-4 w-4" />}
                label="La sesión"
                onClick={() => setPanel(panel === "session" ? null : "session")}
                active={panel === "session"}
              />
              <RailButton
                icon={<HelpCircle className="h-4 w-4" />}
                label="Atajos"
                onClick={() => setShortcutsOpen(true)}
                hideLabel
              />
            </div>
          )}
        </div>

        {/* ── Los paneles: anclados a su botón de la barra ───── */}
        {panel === "captured" && (
          <div className="absolute bottom-14 right-3 z-30 sm:right-5">
            <CapturedPanel
              items={captured}
              onSeek={(seconds) => {
                playerRef.current?.seekTo(seconds);
                onActivity();
              }}
              onClose={() => setPanel(null)}
            />
          </div>
        )}

        {panel === "subtitles" && (
          <div className="absolute bottom-14 right-3 z-30 sm:right-5">
            <SubtitlesPanel
              cueCount={cues.length}
              follow={followSubtitles}
              onFollowChange={setFollowSubtitles}
              onBring={() => setTranscriptHelpOpen(true)}
              onDelete={() => removeTranscript.mutate()}
              onOpenText={() => {
                setPanel(null);
                setTranscriptOpen(true);
              }}
              onClose={() => setPanel(null)}
            />
          </div>
        )}

        {panel === "session" && (
          <div className="absolute bottom-14 right-3 z-30 sm:right-5">
            <SessionPanel
              state={state}
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
              onClose={() => setPanel(null)}
            />
          </div>
        )}

        {/*
          La ficha, centrada al pie.

          Aparece donde estaba la palabra que tocaste —abajo, en la frase— y
          crece hacia arriba: eso es lo que hace que preguntar se lea como
          preguntar y no como que se abrió otra cosa en otra parte de la
          pantalla.
        */}
        {isCapturing && (
          <div className="absolute bottom-14 left-1/2 z-40 -translate-x-1/2">
            <CaptureSheet
              lookupOnly={lookupOnly}
              editingTerm={editingTerm}
              expression={expression}
              onExpressionChange={setExpression}
              onExpressionDone={() => setEditingTerm(false)}
              expressionRef={expressionRef}
              context={context}
              capturedAt={capturedAtRef.current}
              autoEnabled={auto.enabled}
              onToggleAuto={auto.toggle}
              alreadySaved={alreadySaved}
              onMeaning={setMeaning}
              onTranslation={setTranslation}
              onSave={submitCapture}
              onResumeAndSave={resumeAndSave}
              onEditTerm={() => {
                setEditingTerm((value) => !value);
                requestAnimationFrame(() => expressionRef.current?.focus());
              }}
              onClose={() => closeCapture(true)}
            />
          </div>
        )}

        {/* ── Lo que se abre en su propia ventana ────────────── */}
        <Dialog open={transcriptOpen} onOpenChange={setTranscriptOpen}>
          <DialogContent className="max-w-3xl gap-0 p-0">
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
                // Preguntaste desde acá: la ficha aparece al pie de la sala,
                // así que esto se cierra solo —si no, tapa la respuesta.
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
              className="h-[65vh] rounded-none rounded-b-lg border-0"
            />
          </DialogContent>
        </Dialog>

        <StudioShortcutsDialog
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
        />

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
    </TooltipProvider>
  );
}
