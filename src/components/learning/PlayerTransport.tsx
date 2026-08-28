import {
  memo,
  useCallback,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Captions,
  CaptionsOff,
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
  /** El subtítulo sobre el video, encendido o no. */
  captionOn: boolean;
  onToggleCaption: () => void;
}

/**
 * Los controles, dentro del marco del video.
 *
 * Estaban en una fila debajo y costaban sesenta píxeles de alto. En esta
 * pantalla el video está limitado por el alto —su ancho sale de ahí—, así que
 * esos sesenta píxeles no eran una fila: eran un video un cuarto más chico.
 *
 * Así que la fila desaparece y queda lo único que informa algo cuando no estás
 * tocando nada: una línea de tres píxeles al pie con el relieve del video. Al
 * acercar el puntero —o al pausar, que es cuando de verdad los buscas— la línea
 * engorda, aparece la aguja y sube la fila entera. Ni un píxel de la pantalla
 * gastado en botones que no estás mirando.
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
  captionOn,
  onToggleCaption,
}: PlayerTransportProps) {
  const seconds = useSmoothPosition(playbackRef);
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  /** En pausa los controles se quedan a la vista: es cuando los buscas. */
  const revealed = !playing;

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
    setHoverRatio(ratioAt(event.clientX));
    // Arrastrar con el dedo o el botón apretado va buscando en vivo.
    if (event.buttons === 1) seekAt(event.clientX);
  };

  const hoverSeconds = hoverRatio !== null ? hoverRatio * durationSeconds : null;
  const hoverCue =
    hoverSeconds !== null ? cues[activeCueIndex(cues, hoverSeconds)] : undefined;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
      {/* Velo: apenas insinuado mientras corre, entero cuando hay que leer */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent",
          "transition-all duration-300",
          revealed
            ? "h-28 opacity-100"
            : "h-12 opacity-50 group-hover:h-28 group-hover:opacity-100"
        )}
      />

      <div className="pointer-events-auto relative">
        {/* ── La barra ───────────────────────────────────── */}
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
          className="relative mx-4 mb-1 flex h-4 cursor-pointer touch-none items-end"
        >
          <div
            className={cn(
              "relative w-full overflow-hidden rounded-full bg-white/25 transition-all duration-200",
              revealed ? "h-1.5" : "h-[3px] group-hover:h-1.5"
            )}
          >
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
                className={cn(
                  "pointer-events-none absolute bottom-0 w-[2px] -translate-x-1/2 rounded-full bg-amber-300",
                  "transition-all duration-200",
                  revealed ? "h-1.5" : "h-[3px] group-hover:h-1.5"
                )}
                style={{ left: `${Math.min(at / durationSeconds, 1) * 100}%` }}
              />
            ))}

          {/* La aguja solo cuando hay una mano cerca */}
          <span
            className={cn(
              "pointer-events-none absolute bottom-0 size-3 -translate-x-1/2 translate-y-[0.1875rem]",
              "rounded-full bg-primary shadow ring-2 ring-black/25 transition-transform duration-200",
              revealed ? "scale-100" : "scale-0 group-hover:scale-100"
            )}
            style={{ left: `${ratio * 100}%` }}
          />

          {/* Qué se dice ahí: nuestro equivalente a la miniatura de YouTube */}
          {hoverRatio !== null && hoverSeconds !== null && (
            <div
              className={cn(
                "pointer-events-none absolute bottom-full z-10 mb-1.5 w-max max-w-[18rem] -translate-x-1/2",
                "rounded-lg bg-black/85 px-2.5 py-1.5 shadow-lg backdrop-blur-sm"
              )}
              style={{
                left: `${Math.min(Math.max(hoverRatio, 0.08), 0.92) * 100}%`,
              }}
            >
              <p className="text-[11px] font-semibold tabular-nums text-white">
                {formatClock(hoverSeconds)}
              </p>
              {hoverCue && (
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/65">
                  {hoverCue.text}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Los botones ────────────────────────────────── */}
        <div
          className={cn(
            "flex items-center gap-0.5 overflow-hidden px-2 transition-all duration-200",
            revealed
              ? "h-11 opacity-100"
              : "h-0 opacity-0 group-hover:h-11 group-hover:opacity-100"
          )}
        >
          <TransportButton
            onClick={onToggle}
            label={playing ? "Pausar el video" : "Reproducir"}
            icon={
              playing ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 translate-x-[1px] fill-current" />
              )
            }
          />
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
          />
          <TransportButton
            onClick={onToggleCaption}
            label={captionOn ? "Esconder el subtítulo" : "Mostrar el subtítulo"}
            icon={
              captionOn ? (
                <Captions className="h-3.5 w-3.5" />
              ) : (
                <CaptionsOff className="h-3.5 w-3.5" />
              )
            }
            shortcut="C"
            muted={!captionOn}
          />

          <span className="ml-2 shrink-0 text-[11px] tabular-nums text-white/70">
            {formatClock(seconds)}
            <span className="text-white/40">
              {" / "}
              {formatClock(durationSeconds)}
            </span>
          </span>

          <div className="flex-1" />

          <span className="hidden shrink-0 pr-1 text-[10px] text-white/40 lg:inline">
            Espacio ⏯ · ← → 10s · E capturar · C subtítulo
          </span>
        </div>
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
  muted,
}: {
  onClick: () => void;
  label: string;
  icon: ReactNode;
  text?: string;
  shortcut?: string;
  /** Apagado: el botón sigue ahí, pero no compite con los que sí actúan. */
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={shortcut ? `${label} · tecla ${shortcut}` : label}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2",
        muted ? "text-white/40" : "text-white/85",
        "transition-colors hover:bg-white/15 hover:text-white"
      )}
    >
      {icon}
      {text && <span className="text-[11px] font-medium">{text}</span>}
      {shortcut && (
        <kbd className="hidden rounded bg-white/15 px-1 py-0.5 font-mono text-[9px] text-white/80 sm:inline">
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
