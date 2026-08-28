import {
  memo,
  useCallback,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  /** La mano está sobre la barra —o a unos píxeles— y no en cualquier parte. */
  near: boolean;
}

/**
 * Mientras el video corre, esto es una línea de dos píxeles al pie. Nada más.
 *
 * Antes había una fila de botones que subía con el puntero en cualquier parte
 * del cuadro. Con el subtítulo leyéndose encima del video, uno está adentro
 * del cuadro todo el rato: la fila se levantaba mientras leías, que es el
 * reproductor pidiendo atención justo cuando estás en otra cosa.
 *
 * Así que no hay fila. La barra engorda solo si la mano está sobre ella, y no
 * arrastra nada hacia arriba. Los diez segundos, repetir la frase y esconder
 * el subtítulo siguen ahí —son teclas— y viven explicados detrás del signo de
 * pregunta, que aparece con el video en pausa: cuando corre, sobra.
 */
export function PlayerTransport({
  playbackRef,
  playing,
  durationSeconds,
  cues,
  heat,
  markers,
  onSeek,
  near,
}: PlayerTransportProps) {
  const seconds = useSmoothPosition(playbackRef);
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  /** La barra se vuelve barra: con la mano encima, o con el video detenido. */
  const revealed = !playing || near;

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
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent",
          "transition-all duration-300",
          // Mientras corre, ni un píxel de velo: el subtítulo trae el suyo.
          playing ? "h-12 opacity-0" : "h-20 opacity-100"
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
          className={cn(
            "relative flex h-4 cursor-pointer touch-none items-end transition-all duration-200",
            // Nunca se aparta de los bordes: crece hacia arriba y nada más.
            // Los cuatro píxeles de abajo son para que quepa la aguja.
            revealed ? "mb-1" : "mb-0"
          )}
        >
          <div
            className={cn(
              "relative w-full overflow-hidden transition-all duration-200",
              revealed
                ? "h-1.5 rounded-full bg-white/25"
                : "h-[2px] rounded-none bg-white/20"
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
                  revealed ? "h-1.5" : "h-[2px]"
                )}
                style={{ left: `${Math.min(at / durationSeconds, 1) * 100}%` }}
              />
            ))}

          {/* La aguja solo cuando hay una mano cerca */}
          <span
            className={cn(
              "pointer-events-none absolute bottom-0 size-3 -translate-x-1/2 translate-y-[0.1875rem]",
              "rounded-full bg-primary shadow ring-2 ring-black/25 transition-transform duration-200",
              revealed ? "scale-100" : "scale-0"
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

      </div>

      {/*
        En pausa aparece lo mínimo: dónde vas y dónde preguntar. Los botones no
        vuelven —lo que hacían son teclas, y las teclas se aprenden una vez.
      */}
      {!playing && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-6 flex items-end justify-between px-4">
          <span className="text-[11px] font-medium tabular-nums text-white/70">
            {formatClock(seconds)}
            <span className="text-white/35">
              {" / "}
              {formatClock(durationSeconds)}
            </span>
          </span>

          <button
            onClick={() => setShortcutsOpen(true)}
            aria-label="Cómo se maneja esto"
            title="Cómo se maneja esto"
            className={cn(
              "flex size-7 items-center justify-center rounded-full",
              "bg-black/40 text-white/60 backdrop-blur-sm transition-colors",
              "hover:bg-black/60 hover:text-white"
            )}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Cómo se maneja esto</DialogTitle>
          </DialogHeader>

          <div className="space-y-2.5">
            {KEYS.map(([key, what]) => (
              <div key={key} className="flex items-baseline gap-3">
                <kbd className="min-w-16 shrink-0 rounded-md border border-border/60 bg-muted px-2 py-1 text-center text-[11px] font-semibold">
                  {key}
                </kbd>
                <span className="text-sm text-muted-foreground">{what}</span>
              </div>
            ))}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Y lo principal no es una tecla: toca cualquier palabra del subtítulo
            y el video se detiene solo para mostrarte qué significa, justo
            debajo. Al guardarla vuelve a andar.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Lo que se puede hacer sin mover la mano de donde está. */
const KEYS: [string, string][] = [
  ["Espacio", "reproducir o pausar — o toca el video"],
  ["← →", "diez segundos atrás o adelante"],
  ["R", "repetir la frase que acaba de sonar"],
  ["E", "capturar una expresión a mano"],
  ["C", "esconder o mostrar el subtítulo"],
];


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
