import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Plus,
  X,
  Bookmark,
  Captions,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  CONTENT_TYPE_CONFIG,
  youTubeThumbnail,
  youTubeWatchUrl,
} from "@/lib/learning-config";
import type { QueueItem } from "@/hooks/useLearningQueue";
import { useSaveQueueDuration } from "@/hooks/useLearningQueue";
import { useTranscriptStatuses } from "@/hooks/useTranscript";
import { TranscriptHelpDialog } from "./TranscriptHelpDialog";
import { AddVideoDialog } from "./AddVideoDialog";
import { useTranscript } from "@/hooks/useTranscript";
import { YouTubePlayer } from "./YouTubePlayer";
import { ContentCover } from "./ContentCover";
import { ShelfSection } from "./ShelfSection";
import { useShelfOpen } from "@/hooks/useShelfOpen";

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
 * Se ve como una parrilla de videos y no como una lista de tareas: la portada
 * en 16:9 con el largo encima es lo que uno mira para decidir qué ver ahora,
 * y esa decisión es todo el propósito de esta sección.
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
  const [open, setOpen] = useShelfOpen("queue");
  const [adding, setAdding] = useState(false);
  /** Video al que se le están trayendo los subtítulos por adelantado. */
  const [prefetchFor, setPrefetchFor] = useState<string | null>(null);

  const { data: withTranscript } = useTranscriptStatuses();
  /** El "+" abre la estantería si estaba cerrada: guardar algo es abrirla. */
  const startAdding = () => {
    setOpen(true);
    setAdding(true);
  };

  return (
    <ShelfSection
      icon={<Bookmark className="h-4 w-4 text-primary" />}
      title="Para ver después"
      count={queue.length}
      open={open}
      onOpenChange={setOpen}
      action={
        <Button
          onClick={startAdding}
          variant="ghost"
          size="sm"
          className="rounded-xl h-7 px-2 text-muted-foreground shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      }
    >
      <AddVideoDialog
        open={adding}
        onOpenChange={setAdding}
        title="Para ver después"
        description="Te espera hasta que tengas el rato"
        cta="Guardar"
        busy={isAdding}
        onSubmit={(video) => {
          onAdd({
            content_type: "youtube",
            content_url: video.url,
            external_id: video.videoId,
            content_thumbnail: youTubeThumbnail(video.videoId),
            // La vista previa ya preguntó el título: pasarlo evita que el
            // guardado vuelva a preguntarlo antes de aparecer en la lista.
            content_title: video.title,
            ...(video.author ? { content_author: video.author } : {}),
          });
          setAdding(false);
        }}
      />

      {queue.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">
          Cuando encuentres algo que quieras ver, guárdalo acá y te espera.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {queue.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              transcriptReady={
                !!item.external_id && !!withTranscript?.has(item.external_id)
              }
              onStart={() => onStart(item)}
              onRemove={() => onRemove(item.id)}
              onPrefetchTranscript={() => setPrefetchFor(item.external_id)}
            />
          ))}
        </div>
      )}

      <DurationProbe queue={queue} />

      {prefetchFor && (
        <PrefetchTranscript
          externalId={prefetchFor}
          onClose={() => setPrefetchFor(null)}
        />
      )}
    </ShelfSection>
  );
}

// ── Tarjeta ─────────────────────────────────────────────────

function QueueCard({
  item,
  transcriptReady,
  onStart,
  onRemove,
  onPrefetchTranscript,
}: {
  item: QueueItem;
  transcriptReady: boolean;
  onStart: () => void;
  onRemove: () => void;
  onPrefetchTranscript: () => void;
}) {
  const videoId = item.external_id;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/60 bg-background/40",
        "transition-colors hover:border-border"
      )}
    >
      <ContentCover
        externalId={item.external_id}
        thumbnail={item.content_thumbnail}
        contentType={item.content_type}
        title={item.content_title}
        durationSeconds={item.content_duration_seconds}
        onPlay={onStart}
      />

      {/* Sacar de la lista */}
      <button
        onClick={onRemove}
        aria-label="Sacar de la lista"
        className={cn(
          "absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-lg",
          "bg-background/80 text-muted-foreground backdrop-blur-sm",
          "opacity-0 transition-opacity hover:text-destructive",
          "group-hover:opacity-100 focus-visible:opacity-100"
        )}
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Datos */}
      <div className="p-3">
        <p className="text-sm font-medium leading-snug line-clamp-2">
          {item.content_title ?? "Video guardado"}
        </p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {item.content_author ?? CONTENT_TYPE_CONFIG[item.content_type]?.label}
        </p>

        <div className="mt-2 flex items-center gap-1.5">
          {videoId &&
            (transcriptReady ? (
              <span
                className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-500"
                title="Los subtítulos ya están guardados"
              >
                <CheckCircle2 className="h-3 w-3" />
                subtítulos
              </span>
            ) : (
              <button
                onClick={onPrefetchTranscript}
                title="Traerlos ahora, para no hacerlo al empezar"
                className={cn(
                  "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                  "bg-muted text-muted-foreground transition-colors hover:text-primary"
                )}
              >
                <Captions className="h-3 w-3" />
                traer subtítulos
              </button>
            ))}

          {item.content_url && (
            <a
              href={
                videoId ? youTubeWatchUrl(videoId) : item.content_url
              }
              target="_blank"
              rel="noreferrer"
              title="Abrir en YouTube"
              className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              abrir
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Largo de los videos ─────────────────────────────────────

/** Cuánto se espera al reproductor antes de dar por perdido un largo. */
const DURATION_TIMEOUT_MS = 12000;

/**
 * Averigua el largo de los videos que todavía no lo tienen.
 *
 * Ninguna API abierta de YouTube lo entrega sin llave, pero el reproductor sí:
 * se monta uno escondido, de a uno por vez para no cargar la página con varios
 * iframes, y el dato queda guardado en la fila. A la segunda vuelta ya no hace
 * falta montar nada.
 */
function DurationProbe({ queue }: { queue: QueueItem[] }) {
  const saveDuration = useSaveQueueDuration();
  /** Videos que no respondieron: no se reintentan en esta visita. */
  const [skipped, setSkipped] = useState<string[]>([]);

  const pending = queue.find(
    (item) =>
      !!item.external_id &&
      item.content_duration_seconds == null &&
      !skipped.includes(item.id)
  );

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(
      () => setSkipped((ids) => [...ids, pending.id]),
      DURATION_TIMEOUT_MS
    );
    return () => clearTimeout(timer);
  }, [pending]);

  if (!pending?.external_id) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 -z-10 h-px w-px overflow-hidden opacity-0"
    >
      <YouTubePlayer
        key={pending.id}
        videoId={pending.external_id}
        onMeta={(meta) => {
          if (meta.durationSeconds) {
            saveDuration.mutate({
              id: pending.id,
              seconds: meta.durationSeconds,
            });
          } else {
            setSkipped((ids) =>
              ids.includes(pending.id) ? ids : [...ids, pending.id]
            );
          }
        }}
        className="h-px w-px"
      />
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
