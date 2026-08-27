import { useEffect, useRef, type MutableRefObject } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowDown, ClipboardPaste, Wand2 } from "lucide-react";
import { formatClock } from "@/lib/learning-config";
import { type Cue } from "@/lib/transcript";
import { useActiveCue, type PlaybackSample } from "@/hooks/useSmoothPosition";
import { DockLine, type WordMark } from "./DockLine";

interface SubtitleTrackProps {
  cues: Cue[];
  playbackRef: MutableRefObject<PlaybackSample>;
  /** La pista va detrás del video, o la mueves tú. */
  follow: boolean;
  onFollowChange: (follow: boolean) => void;
  onPick: (term: string, cue: Cue) => void;
  onSeek: (seconds: number) => void;
  markOf?: (word: string) => WordMark | null;
  onBringSubtitles: () => void;
  onPasteClipboard: () => void;
  isSaving?: boolean;
  className?: string;
}

/**
 * Los subtítulos, debajo del video y a tamaño de leer.
 *
 * Es una pista que corre, no tres renglones fijos: las transcripciones reales
 * traen líneas de una palabra y párrafos de cuarenta, así que cualquier alto
 * fijo termina pisando texto. Acá la línea que suena se ilumina y la pista se
 * mueve sola para dejarla al centro; lo de antes y lo que viene siguen ahí,
 * apagados, que es exactamente lo que uno necesita para no perder el hilo.
 *
 * Las marcas de vocabulario van solo en la línea activa: marcarlas todas
 * convierte la pista en un sarpullido y deja de leerse.
 */
export function SubtitleTrack({
  cues,
  playbackRef,
  follow,
  onFollowChange,
  onPick,
  onSeek,
  markOf,
  onBringSubtitles,
  onPasteClipboard,
  isSaving,
  className,
}: SubtitleTrackProps) {
  const index = useActiveCue(playbackRef, cues);

  const boxRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  /**
   * Se centra a mano y no con `scrollIntoView`: ese arrastra también a los
   * contenedores de arriba y en el teléfono te mueve la página entera.
   */
  useEffect(() => {
    if (!follow || index < 0) return;
    const box = boxRef.current;
    const line = activeRef.current;
    if (!box || !line) return;

    box.scrollTo({
      top: line.offsetTop - box.clientHeight / 2 + line.clientHeight / 2,
      behavior: "smooth",
    });
  }, [index, follow]);

  /** Una selección de varias palabras manda por sobre el clic simple. */
  const takeSelection = (cue: Cue) => {
    const selected = window.getSelection()?.toString().trim();
    if (selected && selected.split(/\s+/).length > 1) {
      onPick(selected, cue);
      return true;
    }
    return false;
  };

  // ── Sin subtítulos ────────────────────────────────────────

  if (cues.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-2xl px-4 text-center",
          "border border-dashed border-border/70 bg-card",
          className
        )}
      >
        <p className="text-sm font-semibold">
          Sin subtítulos esto es solo un video
        </p>
        <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">
          Con ellos cargados aparece acá lo que se está diciendo, puedes tocar
          cualquier palabra para ver qué significa y la barra de arriba te marca
          dónde se pone difícil. Se traen una vez y quedan para siempre.
        </p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <Button onClick={onBringSubtitles} size="sm" className="rounded-xl">
            <Wand2 className="mr-1.5 h-3.5 w-3.5" />
            Traer subtítulos
          </Button>
          <Button
            onClick={onPasteClipboard}
            variant="ghost"
            size="sm"
            className="rounded-xl"
            disabled={isSaving}
          >
            <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
            Ya los copié
          </Button>
        </div>
      </div>
    );
  }

  // ── La pista ──────────────────────────────────────────────

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-card",
        className
      )}
    >
      <div
        ref={boxRef}
        onWheel={() => onFollowChange(false)}
        onTouchMove={(event) => {
          event.stopPropagation();
          onFollowChange(false);
        }}
        className="relative h-full overflow-y-auto overscroll-contain px-3 py-4 sm:px-4"
        style={{
          touchAction: "pan-y",
          maskImage:
            "linear-gradient(to bottom, transparent, #000 1.25rem, #000 calc(100% - 1.25rem), transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, #000 1.25rem, #000 calc(100% - 1.25rem), transparent)",
        }}
      >
        {cues.map((cue, cueIndex) => {
          const isActive = cueIndex === index;

          return (
            <div
              key={`${cue.t}-${cueIndex}`}
              ref={isActive ? activeRef : undefined}
              className={cn(
                "group/line relative flex gap-3 rounded-xl py-1.5 pl-3 pr-2 transition-colors duration-300",
                isActive && "bg-primary/[0.06]"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary transition-opacity duration-300",
                  isActive ? "opacity-100" : "opacity-0"
                )}
              />

              <button
                onClick={() => onSeek(cue.t)}
                title={`Ir a ${formatClock(cue.t)}`}
                className={cn(
                  "w-11 shrink-0 pt-1 text-left text-[11px] tabular-nums transition-colors",
                  isActive
                    ? "font-semibold text-primary"
                    : "text-muted-foreground/40 hover:text-foreground"
                )}
              >
                {formatClock(cue.t)}
              </button>

              {/* El tamaño no cambia entre líneas: así nada salta al avanzar */}
              <DockLine
                text={cue.text}
                markOf={isActive ? markOf : undefined}
                onPick={(word) => onPick(word, cue)}
                onSelectionPick={() => takeSelection(cue)}
                className={cn(
                  "flex-1 text-base leading-relaxed transition-colors duration-300 sm:text-lg",
                  isActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground/50 group-hover/line:text-muted-foreground/80"
                )}
              />
            </div>
          );
        })}
      </div>

      {/* Te fuiste a mirar otra parte: el camino de vuelta, a la vista */}
      {!follow && (
        <button
          onClick={() => onFollowChange(true)}
          className={cn(
            "absolute bottom-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5",
            "rounded-full border border-border/60 bg-popover/95 px-3 py-1.5 shadow-lg backdrop-blur",
            "text-[11px] font-medium transition-colors hover:text-primary"
          )}
        >
          <ArrowDown className="h-3 w-3" />
          Volver a lo que suena
        </button>
      )}
    </div>
  );
}
