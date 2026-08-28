import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowDown, ClipboardPaste, Wand2 } from "lucide-react";
import { formatClock } from "@/lib/learning-config";
import { sliceWords, segmentAtWord, type Block, type Cue } from "@/lib/transcript";
import type { ActiveSpot } from "@/hooks/useSmoothPosition";
import { DockLine, type WordMark } from "./DockLine";
import { usePhraseSelection, type PhraseSpan } from "@/hooks/usePhraseSelection";

interface SubtitleTrackProps {
  blocks: Block[];
  /** Dónde va la voz: bloque y palabra. */
  active: ActiveSpot;
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
 * La transcripción, debajo del video.
 *
 * Ya no es la superficie de lectura —esa se mudó encima del video, que es donde
 * están tus ojos mientras alguien habla— sino el mapa: se escanea, se salta, se
 * busca dónde quedó algo. Por eso puede ser más densa que antes.
 *
 * Y no muestra líneas de tiempo sino bloques de lectura: los cues de YouTube se
 * cortan cada dos segundos sin mirar dónde, así que como unidad de lectura no
 * sirven. Lo que se lee es la frase; lo que se resalta, la palabra que suena.
 */
export function SubtitleTrack({
  blocks,
  active,
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
  const index = active.block;

  const boxRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  const phrase = usePhraseSelection((span: PhraseSpan) =>
    onPick(...pickFromBlocks(blocks, span))
  );

  /**
   * Se centra a mano y no con `scrollIntoView`: ese arrastra también a los
   * contenedores de arriba y en el teléfono te mueve la página entera.
   *
   * Mientras marcas una frase la pista se queda quieta aunque siga corriendo el
   * video: si se centrara sola, el texto se te escaparía de abajo del dedo.
   */
  useEffect(() => {
    if (!follow || index < 0 || phrase.dragging) return;
    const box = boxRef.current;
    const line = activeRef.current;
    if (!box || !line) return;

    box.scrollTo({
      top: line.offsetTop - box.clientHeight / 2 + line.clientHeight / 2,
      behavior: "smooth",
    });
  }, [index, follow, phrase.dragging]);

  // ── Sin subtítulos ────────────────────────────────────────

  if (blocks.length === 0) {
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
          Con ellos cargados aparece sobre el video lo que se está diciendo, y
          puedes tocar cualquier palabra para ver qué significa. Se traen una
          vez y quedan para siempre.
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
          // Arrastrar para marcar no es irse a mirar otra parte.
          if (!phrase.dragging) onFollowChange(false);
        }}
        data-marking={phrase.marking || undefined}
        className={cn(
          "subtitle-track relative h-full overflow-y-auto overscroll-contain px-3 py-3 sm:px-4",
          // Nadie selecciona texto acá: el gesto es marcar una frase, y si el
          // navegador puede seleccionar por su cuenta se lleva hasta la hora.
          "select-none"
        )}
        style={{
          touchAction: "pan-y",
          maskImage:
            "linear-gradient(to bottom, transparent, #000 1.25rem, #000 calc(100% - 1.25rem), transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, #000 1.25rem, #000 calc(100% - 1.25rem), transparent)",
        }}
      >
        {blocks.map((block, blockIndex) => {
          const isActive = blockIndex === index;

          return (
            <div
              key={`${block.t}-${blockIndex}`}
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
                data-clock
                onClick={() => onSeek(block.t)}
                title={`Ir a ${formatClock(block.t)}`}
                className={cn(
                  "w-11 shrink-0 pt-1 text-left text-[11px] tabular-nums transition-colors",
                  isActive
                    ? "font-semibold text-primary"
                    : "text-muted-foreground/40 hover:text-foreground"
                )}
              >
                {formatClock(block.t)}
              </button>

              {/* El tamaño no cambia entre bloques: así nada salta al avanzar */}
              <DockLine
                text={block.text}
                line={blockIndex}
                markOf={isActive ? markOf : undefined}
                selection={phrase.rangeOf(blockIndex)}
                sweep={isActive ? active.word : null}
                onWordDown={phrase.begin}
                className={cn(
                  "flex-1 text-[15px] leading-relaxed transition-colors duration-300 sm:text-base",
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

/**
 * Qué preguntaste y desde dónde.
 *
 * El segundo que se guarda es el del trozo original donde empieza la frase, no
 * el del bloque: el bloque puede durar diez segundos y volver a su principio
 * sería volver a otra parte. El contexto, en cambio, es todo lo que la frase
 * abarca —una expresión partida no se entiende con la mitad de la oración.
 */
function pickFromBlocks(blocks: Block[], span: PhraseSpan): [string, Cue] {
  const parts: string[] = [];

  for (let line = span.from.line; line <= span.to.line; line++) {
    const from = line === span.from.line ? span.from.ord : 0;
    const to = line === span.to.line ? span.to.ord : Number.POSITIVE_INFINITY;
    const piece = sliceWords(blocks[line].text, from, to);
    if (piece) parts.push(piece);
  }

  const spanned = blocks.slice(span.from.line, span.to.line + 1);
  return [
    parts.join(" ").trim(),
    {
      t: segmentAtWord(blocks[span.from.line], span.from.ord).t,
      text: spanned.map((block) => block.text).join(" "),
    },
  ];
}
