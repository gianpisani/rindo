import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Plus,
  Play,
  X,
  Link2,
  Bookmark,
  Captions,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  CONTENT_TYPE_CONFIG,
  parseYouTubeId,
  youTubeThumbnail,
} from "@/lib/learning-config";
import type { QueueItem } from "@/hooks/useLearningQueue";
import { useTranscriptStatuses } from "@/hooks/useTranscript";
import { TranscriptHelpDialog } from "./TranscriptHelpDialog";
import { useTranscript } from "@/hooks/useTranscript";

interface LearningQueueProps {
  queue: QueueItem[];
  onAdd: (draft: {
    content_type: "youtube" | "other";
    content_url: string | null;
    external_id: string | null;
    content_thumbnail: string | null;
    content_title: string | null;
  }) => void;
  onStart: (item: QueueItem) => void;
  onRemove: (id: string) => void;
  isAdding?: boolean;
}

/**
 * Cola de contenido para ver después.
 *
 * Los subtítulos se pueden adelantar acá: traerlos toma unos segundos y es
 * molesto tener que hacerlo justo cuando te sentaste a estudiar. El tilde
 * indica cuáles ya están listos.
 */
export function LearningQueue({
  queue,
  onAdd,
  onStart,
  onRemove,
  isAdding,
}: LearningQueueProps) {
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  /** Video al que se le están trayendo los subtítulos por adelantado. */
  const [prefetchFor, setPrefetchFor] = useState<string | null>(null);

  const { data: withTranscript } = useTranscriptStatuses();
  const videoId = useMemo(() => parseYouTubeId(url), [url]);
  const canAdd = url.trim().length > 0;

  const submit = () => {
    if (!canAdd) return;
    onAdd({
      content_type: videoId ? "youtube" : "other",
      content_url: videoId
        ? `https://www.youtube.com/watch?v=${videoId}`
        : url.trim(),
      external_id: videoId,
      content_thumbnail: videoId ? youTubeThumbnail(videoId) : null,
      content_title: videoId ? null : url.trim(),
    });
    setUrl("");
    setAdding(false);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-primary" />
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Para ver después
          </p>
          {queue.length > 0 && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {queue.length}
            </span>
          )}
        </div>

        {!adding && (
          <Button
            onClick={() => setAdding(true)}
            variant="ghost"
            size="sm"
            className="rounded-xl h-7 px-2 text-muted-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {adding && (
        <div className="space-y-2 mb-3">
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") {
                  setAdding(false);
                  setUrl("");
                }
              }}
              placeholder="Pega el link del video"
              autoFocus
              className="pl-9 h-10 rounded-xl text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={submit}
              disabled={!canAdd || isAdding}
              size="sm"
              className="rounded-xl flex-1"
            >
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
            <Button
              onClick={() => {
                setAdding(false);
                setUrl("");
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

      {queue.length === 0 ? (
        !adding && (
          <p className="text-xs text-muted-foreground py-2">
            Cuando encuentres algo que quieras ver, pégalo acá y te espera.
          </p>
        )
      ) : (
        <div className="space-y-1.5">
          {queue.map((item) => {
            const ready = !!item.external_id && !!withTranscript?.has(item.external_id);

            return (
              <div
                key={item.id}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-2.5 py-2 -mx-1",
                  "transition-colors hover:bg-muted/50"
                )}
              >
                {item.content_thumbnail ? (
                  <img
                    src={item.content_thumbnail}
                    alt=""
                    className="h-10 w-16 rounded-lg object-cover border border-border/50 shrink-0"
                  />
                ) : (
                  <div className="h-10 w-16 rounded-lg bg-muted flex items-center justify-center shrink-0 text-base">
                    {CONTENT_TYPE_CONFIG[item.content_type]?.emoji ?? "✨"}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {item.content_title ?? "Video guardado"}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate">
                      {item.content_author ??
                        CONTENT_TYPE_CONFIG[item.content_type]?.label}
                    </span>

                    {item.external_id && (
                      <span
                        className={cn(
                          "flex items-center gap-0.5 shrink-0",
                          ready ? "text-emerald-500" : "text-muted-foreground/60"
                        )}
                        title={
                          ready
                            ? "Subtítulos listos"
                            : "Todavía sin subtítulos"
                        }
                      >
                        ·
                        {ready ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Captions className="h-3 w-3" />
                        )}
                        <span>{ready ? "subtítulos" : "sin subtítulos"}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {item.external_id && !ready && (
                    <Button
                      onClick={() => setPrefetchFor(item.external_id)}
                      variant="ghost"
                      size="sm"
                      aria-label="Traer subtítulos ahora"
                      title="Adelantar los subtítulos"
                      className="rounded-lg h-8 px-2 text-muted-foreground hover:text-primary"
                    >
                      <Captions className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    onClick={() => onStart(item)}
                    size="sm"
                    className="rounded-lg h-8 px-2.5"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                  </Button>
                  <Button
                    onClick={() => onRemove(item.id)}
                    variant="ghost"
                    size="sm"
                    aria-label="Sacar de la lista"
                    className="rounded-lg h-8 px-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {prefetchFor && (
        <PrefetchTranscript
          externalId={prefetchFor}
          onClose={() => setPrefetchFor(null)}
        />
      )}
    </div>
  );
}

/**
 * Trae los subtítulos de un video de la lista sin abrir una sesión.
 * Reusa el mismo diálogo y el mismo guardado que dentro del estudio.
 */
function PrefetchTranscript({
  externalId,
  onClose,
}: {
  externalId: string;
  onClose: () => void;
}) {
  const { save } = useTranscript(externalId);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return;
      save.mutate(text, { onSuccess: onClose });
    } catch {
      /* el diálogo ya ofrece pegar a mano */
    }
  };

  return (
    <TranscriptHelpDialog
      open
      onOpenChange={(open) => !open && onClose()}
      externalId={externalId}
      onPasteFromClipboard={pasteFromClipboard}
    />
  );
}
