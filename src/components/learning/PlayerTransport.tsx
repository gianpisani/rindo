import {
  memo,
  useCallback,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ExternalLink,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/learning-config";
import { activeCueIndex, type Cue } from "@/lib/transcript";
import { useSmoothPosition, type PlaybackSample } from "@/hooks/useSmoothPosition";

interface PlayerTransportProps {
  playbackRef: MutableRefObject<PlaybackSample>;
  playing: boolean;
  durationSeconds: number;
  cues: Cue[];
  /** Relieve de dificultad, un valor 0–1 por tramo. */
  heat: number[];
  /** Segundos donde capturaste algo: quedan clavados como hitos. */
  markers: number[];
  onSeek: (seconds: number) => void;
  onSeekBy: (seconds: number) => void;
  onToggle: () => void;
  onRepeatLine: () => void;
  youtubeUrl?: string | null;
}

/**
 * Los controles del video, que son nuestros y no de YouTube.
 *
 * La barra no es solo dónde vas: está pintada con el relieve del video, así que
 * ves dónde se pone difícil *antes* de llegar, y con los puntos de lo que
 * capturaste. Eso es lo que un embed nunca te va a dar, y es la razón entera de
 * haberle sacado el cromo al reproductor.
 */
export function PlayerTransport({
  playbackRef,
  playing,
  durationSeconds,
  cues,
  heat,
  markers,
  onSeek,
  onSeekBy,
  onToggle,
  onRepeatLine,
  youtubeUrl,
}: PlayerTransportProps) {
  const seconds = useSmoothPosition(playbackRef);
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  const ratio = durationSeconds > 0 ? Math.min(seconds / durationSeconds, 1) : 0;

  const ratioAt = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  }, []);

  const seekAt = useCallback(
    (clientX: number) => {
      const next = ratioAt(clientX);
      if (next === null || durationSeconds <= 0) return;
      onSeek(next * durationSeconds);
    },
    [ratioAt, durationSeconds, onSeek]
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    seekAt(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const next = ratioAt(event.clientX);
    setHoverRatio(next);
    // Arrastrar con el dedo o el botón apretado va buscando en vivo.
    if (event.buttons === 1) seekAt(event.clientX);
  };

  const hoverSeconds = hoverRatio !== null ? hoverRatio * durationSeconds : null;
  const hoverCue =
    hoverSeconds !== null ? cues[activeCueIndex(cues, hoverSeconds)] : undefined;

  return (
    <div className="shrink-0">
      {/* ── La barra ─────────────────────────────────────── */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverRatio(null)}
        role="slider"
        aria-label="Posición del video"
        aria-valuemin={0}
        aria-valuemax={Math.round(durationSeconds)}
        aria-valuenow={Math.round(seconds)}
        tabIndex={0}
        className="group relative flex h-6 cursor-pointer touch-none items-center"
      >
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted transition-all duration-150 group-hover:h-2.5">
          <HeatTrack heat={heat} />
          <div
            className="absolute inset-y-0 left-0 bg-primary"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>

        {/* Dónde capturaste algo */}
        {durationSeconds > 0 &&
          markers.map((at, index) => (
            <span
              key={`${at}-${index}`}
              title={`Capturaste algo en ${formatClock(at)}`}
              className="pointer-events-none absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 ring-1 ring-background"
              style={{ left: `${Math.min(at / durationSeconds, 1) * 100}%` }}
            />
          ))}

        {/* Dónde vas */}
        <span
          className="pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-sm ring-2 ring-background transition-transform group-hover:scale-125"
          style={{ left: `${ratio * 100}%` }}
        />

        {/* Qué se dice ahí: el equivalente nuestro a la miniatura de YouTube */}
        {hoverRatio !== null && hoverSeconds !== null && (
          <div
            className="pointer-events-none absolute bottom-full z-10 mb-1 w-max max-w-[16rem] -translate-x-1/2 rounded-lg border border-border/60 bg-popover px-2 py-1 shadow-lg"
            style={{
              left: `${Math.min(Math.max(hoverRatio, 0.08), 0.92) * 100}%`,
            }}
          >
            <p className="text-[11px] font-semibold tabular-nums">
              {formatClock(hoverSeconds)}
            </p>
            {hoverCue && (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                {hoverCue.text}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Los botones ──────────────────────────────────── */}
      <div className="mt-1 flex items-center gap-1">
        <button
          onClick={onToggle}
          aria-label={playing ? "Pausar el video" : "Reproducir"}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            "bg-primary text-primary-foreground transition-transform hover:scale-105"
          )}
        >
          {playing ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 translate-x-[1px] fill-current" />
          )}
        </button>

        <TransportButton
          onClick={() => onSeekBy(-10)}
          label="Retroceder 10 segundos"
          icon={<RotateCcw className="h-3.5 w-3.5" />}
          text="10s"
        />
        <TransportButton
          onClick={() => onSeekBy(10)}
          label="Adelantar 10 segundos"
          icon={<RotateCw className="h-3.5 w-3.5" />}
          text="10s"
        />

        <TransportButton
          onClick={onRepeatLine}
          label="Repetir la frase"
          icon={<Repeat className="h-3.5 w-3.5" />}
          text="Repetir frase"
          shortcut="R"
          highlight
        />

        <span className="ml-1.5 shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {formatClock(seconds)}
          <span className="text-muted-foreground/60">
            {" / "}
            {formatClock(durationSeconds)}
          </span>
        </span>

        <div className="flex-1" />

        <span className="mr-3 hidden shrink-0 text-[10px] text-muted-foreground/70 lg:inline">
          Espacio ⏯ · ← → 10s · E capturar
        </span>

        <span className="hidden shrink-0 items-center gap-2.5 text-[10px] text-muted-foreground xl:flex">
          <span className="flex items-center gap-1">
            <span className="h-0 w-3.5 border-b-2 border-dotted border-[var(--band-4)]" />
            sobre tu nivel
          </span>
          <span className="flex items-center gap-1">
            <span className="h-0 w-3.5 border-b-2 border-primary" />
            ya la tienes
          </span>
        </span>

        {youtubeUrl && (
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-2.5 flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
            YouTube
          </a>
        )}
      </div>
    </div>
  );
}

function TransportButton({
  onClick,
  label,
  icon,
  text,
  shortcut,
  highlight,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  text: string;
  shortcut?: string;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={shortcut ? `${label} · tecla ${shortcut}` : label}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 transition-colors",
        highlight
          ? "text-foreground hover:bg-primary/10 hover:text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      <span className="text-[11px] font-medium">{text}</span>
      {shortcut && (
        <kbd className="ml-0.5 hidden rounded bg-muted px-1 py-0.5 font-mono text-[9px] sm:inline">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

/**
 * El relieve se repinta solo cuando cambia el video, nunca con el minuto: si
 * se reconciliara sesenta veces por segundo junto con la aguja, la barra
 * costaría más que el reproductor.
 */
const HeatTrack = memo(function HeatTrack({ heat }: { heat: number[] }) {
  if (heat.length === 0) return null;

  return (
    <div className="absolute inset-0 flex" aria-hidden>
      {heat.map((value, index) => (
        <span
          key={index}
          className="flex-1 bg-[var(--band-4)]"
          style={{ opacity: value }}
        />
      ))}
    </div>
  );
});
