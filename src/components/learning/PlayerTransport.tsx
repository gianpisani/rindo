import {
  useCallback,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/learning-config";
import { useSmoothPosition, type PlaybackSample } from "@/hooks/useSmoothPosition";

interface PlayerTransportProps {
  playbackRef: MutableRefObject<PlaybackSample>;
  playing: boolean;
  durationSeconds: number;
  /** Segundos donde capturaste algo: quedan clavados como hitos. */
  markers: number[];
  onSeek: (seconds: number) => void;
  className?: string;
}

/**
 * Dónde vas, en su propia franja al pie de la pantalla.
 *
 * Y la barra es la barra: dónde vas y nada encima. Tenía pintado el relieve de
 * dificultad del video y, al pasar por encima, la frase que se decía ahí. Dos
 * cosas ciertas y bien hechas que igual sobran: el relieve compite con lo único
 * que la barra tiene que decir, y la frase ya se lee, grande, sobre el video.
 *
 * Vivía dentro del cuadro, tapándole los dos píxeles de abajo y obligando a un
 * cálculo de "¿está la mano cerca?" para no despertarse mientras leías el
 * subtítulo. Ahora vive fuera de la imagen, pegada a su borde inferior: nada
 * que tapar, nada que adivinar. Engorda cuando le pasas por encima —a ella, no
 * al video— y cuando el video está detenido.
 *
 * Los diez segundos, repetir la frase y esconder el subtítulo siguen siendo
 * teclas, y viven explicados en el signo de pregunta de la barra de abajo.
 */
export function PlayerTransport({
  playbackRef,
  playing,
  durationSeconds,
  markers,
  onSeek,
  className,
}: PlayerTransportProps) {
  const seconds = useSmoothPosition(playbackRef);
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const [hovering, setHovering] = useState(false);

  /** La barra se vuelve barra: con la mano encima, o con el video detenido. */
  const revealed = !playing || hovering;

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

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => {
        setHovering(false);
        setHoverRatio(null);
      }}
      role="slider"
      aria-label="Posición del video"
      aria-valuemin={0}
      aria-valuemax={Math.round(durationSeconds)}
      aria-valuenow={Math.round(seconds)}
      tabIndex={0}
      className={cn(
        "relative flex h-4 cursor-pointer touch-none items-center",
        className
      )}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full transition-all duration-200",
          revealed ? "h-1.5 bg-foreground/25" : "h-[3px] bg-foreground/15"
        )}
      >
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
              "pointer-events-none absolute w-[2px] -translate-x-1/2 rounded-full bg-amber-300",
              "transition-all duration-200",
              revealed ? "h-1.5" : "h-[3px]"
            )}
            style={{ left: `${Math.min(at / durationSeconds, 1) * 100}%` }}
          />
        ))}

      {/* La aguja solo cuando hay una mano cerca */}
      <span
        className={cn(
          "pointer-events-none absolute size-3 -translate-x-1/2",
          "rounded-full bg-primary shadow ring-2 ring-background/60 transition-transform duration-200",
          revealed ? "scale-100" : "scale-0"
        )}
        style={{ left: `${ratio * 100}%` }}
      />

      {/* En qué minuto caería el clic */}
      {hoverRatio !== null && hoverSeconds !== null && (
        <div
          className={cn(
            "pointer-events-none absolute bottom-full z-10 mb-1 w-max -translate-x-1/2",
            "studio-glass rounded-lg px-2 py-0.5"
          )}
          style={{
            left: `${Math.min(Math.max(hoverRatio, 0.05), 0.95) * 100}%`,
          }}
        >
          <p className="text-[11px] font-semibold tabular-nums">
            {formatClock(hoverSeconds)}
          </p>
        </div>
      )}
    </div>
  );
}
