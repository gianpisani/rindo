import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FileText,
  Loader2,
  Trash2,
  Crosshair,
  Wand2,
  ClipboardPaste,
} from "lucide-react";
import { formatClock } from "@/lib/learning-config";
import { activeCueIndex, splitWords, type Cue } from "@/lib/transcript";
import { useTranscript } from "@/hooks/useTranscript";
import { TranscriptHelpDialog } from "./TranscriptHelpDialog";

interface TranscriptPanelProps {
  externalId: string;
  positionSeconds: number;
  onPick: (term: string, cue: Cue) => void;
  onSeek: (seconds: number) => void;
  className?: string;
}

/**
 * Magnificación tipo dock de macOS: la palabra bajo el cursor crece y sus
 * vecinas se apartan.
 *
 * El truco está en cómo se aparta cada una. Con márgenes reales la línea se
 * ensancha y la última palabra se va al renglón de abajo, que es horrible.
 * Así que nadie cambia de tamaño en el layout: la palabra crece con `scale` y
 * las demás se corren con `translateX`. Ninguna de las dos transformaciones
 * afecta al flujo, así que la línea jamás se reacomoda —igual que el dock, que
 * tampoco mueve el resto de la pantalla.
 */
const DOCK_SCALE = [1.3, 1.12, 1.04];

interface DockLayout {
  scale: number[];
  shift: number[];
}

/**
 * Calcula, para cada trozo de la línea, cuánto crece y cuánto se corre.
 *
 * El desplazamiento de un trozo es el ancho extra que aparece entre su centro
 * y el centro de la palabra señalada: la mitad del extra de la señalada, más
 * el extra completo de las que quedan en medio, más la mitad del suyo propio.
 */
function computeDock(
  parts: { isWord: boolean; ord: number }[],
  widths: number[],
  hoveredOrd: number
): DockLayout {
  const scale = parts.map((part) =>
    part.isWord ? (DOCK_SCALE[Math.abs(hoveredOrd - part.ord)] ?? 1) : 1
  );
  const extra = scale.map((s, i) => (s - 1) * (widths[i] ?? 0));

  const center = parts.findIndex((p) => p.isWord && p.ord === hoveredOrd);
  const shift = parts.map(() => 0);
  if (center === -1) return { scale, shift };

  let running = extra[center] / 2;
  for (let i = center + 1; i < parts.length; i++) {
    shift[i] = running + extra[i] / 2;
    running += extra[i];
  }

  running = extra[center] / 2;
  for (let i = center - 1; i >= 0; i--) {
    shift[i] = -(running + extra[i] / 2);
    running += extra[i];
  }

  return { scale, shift };
}

export function TranscriptPanel({
  externalId,
  positionSeconds,
  onPick,
  onSeek,
  className,
}: TranscriptPanelProps) {
  const { transcript, isLoading, save, remove } = useTranscript(externalId);
  const [pasteMode, setPasteMode] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [follow, setFollow] = useState(true);
  const [hovered, setHovered] = useState<{ cue: number; word: number } | null>(
    null
  );
  /** Anchos naturales de las palabras de la línea que se está señalando. */
  const [measured, setMeasured] = useState<{ cue: number; widths: number[] }>({
    cue: -1,
    widths: [],
  });

  const activeRef = useRef<HTMLDivElement>(null);

  const cues = useMemo(() => transcript?.cues ?? [], [transcript]);
  const activeIndex = useMemo(
    () => activeCueIndex(cues, positionSeconds),
    [cues, positionSeconds]
  );

  // Cada línea se parte una sola vez, no en cada render. `ord` es el número de
  // palabra dentro de la línea: la distancia del dock se mide en palabras, no
  // en trozos, para que los espacios no cuenten.
  const wordsByCue = useMemo(
    () =>
      cues.map((c) => {
        let ord = -1;
        return splitWords(c.text).map((part) => {
          if (part.isWord) ord += 1;
          return { ...part, ord: part.isWord ? ord : -1 };
        });
      }),
    [cues]
  );

  /**
   * Mide los anchos naturales al entrar a una línea nueva. En ese momento
   * ninguna de sus palabras está agrandada, así que la medida es la real.
   */
  const handleWordEnter = useCallback(
    (cueIndex: number, ord: number, el: HTMLElement) => {
      setHovered((prev) =>
        prev?.cue === cueIndex && prev.word === ord
          ? prev
          : { cue: cueIndex, word: ord }
      );

      setMeasured((prev) => {
        if (prev.cue === cueIndex) return prev;
        const line = el.parentElement;
        if (!line) return prev;
        const widths = Array.from(line.querySelectorAll<HTMLElement>("[data-part]")).map(
          (node) => node.getBoundingClientRect().width
        );
        return { cue: cueIndex, widths };
      });
    },
    []
  );

  useEffect(() => {
    if (!follow || activeIndex < 0) return;
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex, follow]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.error("El portapapeles está vacío");
        return;
      }
      save.mutate(text);
    } catch {
      toast.error("No pude leer el portapapeles", {
        description: "Usa «Pegar a mano».",
      });
      setPasteMode(true);
    }
  }, [save]);

  // ── Sin transcripción todavía ─────────────────────────────

  if (isLoading) {
    return (
      <div className={cn("rounded-2xl border border-border/60 bg-card p-4", className)}>
        <div className="h-24 rounded-xl bg-muted/40 animate-pulse" />
      </div>
    );
  }

  if (!transcript || pasteMode) {
    return (
      <div className={cn("rounded-2xl border border-border/60 bg-card p-4", className)}>
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Transcripción</h3>
        </div>

        {!pasteMode ? (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Con los subtítulos cargados puedes hacer clic en cualquier palabra
              para ver qué significa y guardarla con su frase y su minuto. Se
              traen una vez por video y quedan guardados para siempre.
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              <Button onClick={() => setHelpOpen(true)} size="sm" className="rounded-xl">
                <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                Traer subtítulos
              </Button>
              <Button
                onClick={pasteFromClipboard}
                variant="ghost"
                size="sm"
                className="rounded-xl"
                disabled={save.isPending}
              >
                <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" />
                Ya los copié
              </Button>
            </div>

            <TranscriptHelpDialog
              open={helpOpen}
              onOpenChange={setHelpOpen}
              externalId={externalId}
              onPasteFromClipboard={pasteFromClipboard}
            />
          </>
        ) : (
          <div className="space-y-2">
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={"0:00\nI'm 57 years old and if you're\n0:03\nin your 20s, watch this…"}
              rows={6}
              autoFocus
              className="rounded-xl resize-none text-xs font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Sirve el copiado de YouTube, y también .srt o .vtt.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  save.mutate(raw, {
                    onSuccess: () => {
                      setPasteMode(false);
                      setRaw("");
                    },
                  })
                }
                disabled={!raw.trim() || save.isPending}
                size="sm"
                className="rounded-xl flex-1"
              >
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
              </Button>
              <Button
                onClick={() => {
                  setPasteMode(false);
                  setRaw("");
                }}
                variant="ghost"
                size="sm"
                className="rounded-xl"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Transcripción cargada ─────────────────────────────────

  /** Una selección de varias palabras manda por sobre el clic simple. */
  const takeSelection = (cue: Cue) => {
    const selected = window.getSelection()?.toString().trim();
    if (selected && selected.split(/\s+/).length > 1) {
      onPick(selected, cue);
      return true;
    }
    return false;
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card overflow-hidden flex flex-col",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
          <h3 className="text-xs font-semibold">Transcripción</h3>
          <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
            clic en una palabra · arrastra para una frase
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            onClick={() => setFollow((v) => !v)}
            variant="ghost"
            size="sm"
            aria-label={follow ? "Dejar de seguir el video" : "Seguir el video"}
            title={follow ? "Siguiendo el video" : "Scroll libre"}
            className={cn(
              "rounded-lg h-7 px-2",
              follow ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Crosshair className="h-3.5 w-3.5" />
          </Button>
          <Button
            onClick={() => remove.mutate()}
            variant="ghost"
            size="sm"
            aria-label="Eliminar transcripción"
            className="rounded-lg h-7 px-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        onWheel={() => setFollow(false)}
        onMouseLeave={() => setHovered(null)}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3"
        style={{ touchAction: "pan-y" }}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {cues.map((cue, cueIndex) => {
          const isActive = cueIndex === activeIndex;
          const words = wordsByCue[cueIndex];
          const dock =
            hovered?.cue === cueIndex && measured.cue === cueIndex
              ? computeDock(words, measured.widths, hovered.word)
              : null;

          return (
            <div
              key={`${cue.t}-${cueIndex}`}
              ref={isActive ? activeRef : undefined}
              onMouseUp={() => takeSelection(cue)}
              className={cn(
                "group/line relative rounded-xl px-3 py-2 transition-colors duration-300",
                isActive && "bg-primary/[0.07]"
              )}
            >
              {/* Barra de la línea activa */}
              <span
                className={cn(
                  "absolute left-0 top-2 bottom-2 w-[3px] rounded-full transition-all duration-300",
                  isActive ? "bg-primary opacity-100" : "opacity-0"
                )}
              />

              <button
                onClick={() => onSeek(cue.t)}
                className={cn(
                  "text-[10px] tabular-nums transition-colors mb-0.5 block",
                  isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground/50 hover:text-foreground"
                )}
              >
                {formatClock(cue.t)}
              </button>

              {/* El tamaño no cambia entre líneas: así nada salta al avanzar */}
              <p
                className={cn(
                  "text-sm sm:text-base leading-relaxed transition-colors duration-300",
                  isActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground/55 group-hover/line:text-muted-foreground"
                )}
              >
                {words.map((part, partIndex) => {
                  const scale = dock?.scale[partIndex] ?? 1;
                  const shift = dock?.shift[partIndex] ?? 0;
                  const isFocus = scale === DOCK_SCALE[0];

                  const style: CSSProperties = {
                    transform:
                      shift || scale !== 1
                        ? `translateX(${shift}px) scale(${scale})`
                        : undefined,
                    transformOrigin: "center bottom",
                    transition:
                      "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), color 140ms ease-out",
                    willChange: dock ? "transform" : undefined,
                  };

                  if (!part.isWord) {
                    // `whitespace-pre` es obligatorio: un inline-block que solo
                    // contiene un espacio lo colapsa a cero y las palabras
                    // quedan pegadas.
                    return (
                      <span
                        key={partIndex}
                        data-part
                        className="inline-block whitespace-pre"
                        style={style}
                      >
                        {part.value}
                      </span>
                    );
                  }

                  return (
                    <span
                      key={partIndex}
                      data-part
                      onMouseEnter={(e) =>
                        handleWordEnter(cueIndex, part.ord, e.currentTarget)
                      }
                      onClick={() => {
                        if (!takeSelection(cue)) onPick(part.value, cue);
                      }}
                      className={cn(
                        "inline-block cursor-pointer rounded",
                        isFocus && "font-bold text-primary"
                      )}
                      style={style}
                    >
                      {part.value}
                    </span>
                  );
                })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
