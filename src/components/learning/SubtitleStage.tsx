import { useCallback, useMemo, useState, type MutableRefObject } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Captions, ClipboardPaste, Wand2 } from "lucide-react";
import { formatClock } from "@/lib/learning-config";
import { activeCueIndex, type Cue } from "@/lib/transcript";
import { DOCK_SCALE_LARGE } from "@/lib/dock";
import { useTranscript } from "@/hooks/useTranscript";
import { useSmoothPosition, type PlaybackSample } from "@/hooks/useSmoothPosition";
import { DockLine, type WordMark } from "./DockLine";
import { TranscriptHelpDialog } from "./TranscriptHelpDialog";

interface SubtitleStageProps {
  externalId: string;
  playbackRef: MutableRefObject<PlaybackSample>;
  onPick: (term: string, cue: Cue) => void;
  onSeek: (seconds: number) => void;
  /** Qué sabe el corpus de cada palabra. */
  markOf?: (word: string) => WordMark | null;
  className?: string;
}

/**
 * La frase que suena, en grande, pegada al video.
 *
 * Antes el subtítulo vivía tres columnas a la derecha en letra de 14px, así que
 * mirabas el video y leías en otra parte. Acá abajo, en cambio, es lo que
 * estás oyendo: la anterior apagada arriba, la que viene insinuada abajo, y en
 * el medio la de ahora, con cada palabra tocable y marcada según lo que el
 * corpus sabe de ella. El subtítulo deja de transcribir y pasa a avisarte.
 */
export function SubtitleStage({
  externalId,
  playbackRef,
  onPick,
  onSeek,
  markOf,
  className,
}: SubtitleStageProps) {
  const { transcript, isLoading, save } = useTranscript(externalId);
  const [helpOpen, setHelpOpen] = useState(false);
  const seconds = useSmoothPosition(playbackRef);

  const cues = useMemo(() => transcript?.cues ?? [], [transcript]);
  const index = activeCueIndex(cues, seconds);

  const current = index >= 0 ? cues[index] : null;
  const previous = index > 0 ? cues[index - 1] : null;
  const next = cues[index + 1] ?? null;

  /** Cuánto llevas de esta frase: lo único que se mueve mientras nadie habla. */
  const lineRatio = useMemo(() => {
    if (!current) return 0;
    const end = next?.t ?? current.t + 4;
    const span = Math.max(end - current.t, 0.5);
    return Math.min(Math.max((seconds - current.t) / span, 0), 1);
  }, [current, next, seconds]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.error("El portapapeles está vacío");
        return;
      }
      save.mutate(text, { onSuccess: () => setHelpOpen(false) });
    } catch {
      toast.error("No pude leer el portapapeles", {
        description: "Ábrelo con «Traer subtítulos» y pégalos ahí.",
      });
    }
  }, [save]);

  /** Una selección de varias palabras manda por sobre el clic simple. */
  const takeSelection = useCallback(
    (cue: Cue) => {
      const selected = window.getSelection()?.toString().trim();
      if (selected && selected.split(/\s+/).length > 1) {
        onPick(selected, cue);
        return true;
      }
      return false;
    },
    [onPick]
  );

  // ── Sin subtítulos ────────────────────────────────────────

  if (!isLoading && cues.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-2xl px-4 text-center",
          "border border-dashed border-border/70 bg-card",
          className,
          // El pedido de subtítulos es más alto que una frase: acá el alto fijo
          // estorba, así que se lo deja crecer.
          "h-auto min-h-[8.5rem] py-4"
        )}
      >
        <p className="text-sm font-semibold">
          Sin subtítulos esto es solo un video
        </p>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          Con ellos cargados aparece acá la frase que suena, puedes tocar
          cualquier palabra para ver qué significa y la barra de arriba te marca
          dónde se pone difícil. Se traen una vez y quedan para siempre.
        </p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <Button onClick={() => setHelpOpen(true)} size="sm" className="rounded-xl">
            <Wand2 className="mr-1.5 h-3.5 w-3.5" />
            Traer subtítulos
          </Button>
          <Button
            onClick={pasteFromClipboard}
            variant="ghost"
            size="sm"
            className="rounded-xl"
            disabled={save.isPending}
          >
            <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
            Ya los copié
          </Button>
        </div>

        <TranscriptHelpDialog
          open={helpOpen}
          onOpenChange={setHelpOpen}
          externalId={externalId}
          onPasteFromClipboard={pasteFromClipboard}
        />
      </div>
    );
  }

  // ── Con subtítulos ────────────────────────────────────────

  return (
    <div
      className={cn(
        "relative flex flex-col justify-center gap-1 overflow-hidden rounded-2xl",
        "border border-border/60 bg-card px-4 py-2 sm:px-5",
        className
      )}
    >
      <ContextLine cue={previous} onSeek={onSeek} align="up" />

      <div className="flex min-h-[2.6em] items-center">
        {current ? (
          <DockLine
            key={`${current.t}-${index}`}
            text={current.text}
            steps={DOCK_SCALE_LARGE}
            markOf={markOf}
            onPick={(word) => onPick(word, current)}
            onSelectionPick={() => takeSelection(current)}
            className="text-lg font-medium leading-snug sm:text-xl lg:text-2xl"
          />
        ) : (
          <p className="text-lg font-medium leading-snug text-muted-foreground/50 sm:text-xl lg:text-2xl">
            {cues.length > 0
              ? `Empieza en ${formatClock(cues[0].t)}`
              : "Cargando subtítulos…"}
          </p>
        )}
      </div>

      <ContextLine cue={next} onSeek={onSeek} align="down" />

      {/* Cuánto llevas de esta frase */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary/50 transition-transform duration-150 ease-linear"
        style={{ transform: `scaleX(${lineRatio})` }}
      />
    </div>
  );
}

/**
 * La de antes y la que viene. Se pueden tocar: volver a oír la frase anterior
 * es el gesto que uno hace mil veces, y hasta ahora había que cazarla en la
 * barra.
 */
function ContextLine({
  cue,
  onSeek,
  align,
}: {
  cue: Cue | null;
  onSeek: (seconds: number) => void;
  align: "up" | "down";
}) {
  if (!cue) return <span className="h-5 shrink-0" aria-hidden />;

  return (
    <button
      onClick={() => onSeek(cue.t)}
      title={`Ir a ${formatClock(cue.t)}`}
      className={cn(
        "h-5 shrink-0 truncate text-left text-xs transition-colors sm:text-sm",
        "text-muted-foreground/40 hover:text-muted-foreground",
        align === "up" ? "order-first" : "order-last"
      )}
    >
      {cue.text}
    </button>
  );
}
