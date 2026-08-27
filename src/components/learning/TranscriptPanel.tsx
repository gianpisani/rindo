import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { activeCueIndex, type Cue } from "@/lib/transcript";
import { useTranscript } from "@/hooks/useTranscript";
import { TranscriptHelpDialog } from "./TranscriptHelpDialog";
import { DockLine } from "./DockLine";

interface TranscriptPanelProps {
  externalId: string;
  positionSeconds: number;
  onPick: (term: string, cue: Cue) => void;
  onSeek: (seconds: number) => void;
  className?: string;
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

  const activeRef = useRef<HTMLDivElement>(null);

  const cues = useMemo(() => transcript?.cues ?? [], [transcript]);
  const activeIndex = useMemo(
    () => activeCueIndex(cues, positionSeconds),
    [cues, positionSeconds]
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
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3"
        style={{ touchAction: "pan-y" }}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {cues.map((cue, cueIndex) => {
          const isActive = cueIndex === activeIndex;

          return (
            <div
              key={`${cue.t}-${cueIndex}`}
              ref={isActive ? activeRef : undefined}
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
              <DockLine
                text={cue.text}
                onPick={(word) => onPick(word, cue)}
                onSelectionPick={() => takeSelection(cue)}
                className={cn(
                  "text-sm sm:text-base leading-relaxed transition-colors duration-300",
                  isActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground/55 group-hover/line:text-muted-foreground"
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
