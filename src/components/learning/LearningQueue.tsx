import { useEffect, useMemo, useState } from "react";
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
  ExternalLink,
} from "lucide-react";
import {
  CONTENT_TYPE_CONFIG,
  formatClock,
  parseYouTubeId,
  youTubeThumbnail,
  youTubeWatchUrl,
} from "@/lib/learning-config";
import type { QueueItem } from "@/hooks/useLearningQueue";
import { useSaveQueueDuration } from "@/hooks/useLearningQueue";
import { useTranscriptStatuses } from "@/hooks/useTranscript";
import { TranscriptHelpDialog } from "./TranscriptHelpDialog";
import { useTranscript } from "@/hooks/useTranscript";
import { YouTubePlayer } from "./YouTubePlayer";

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
        <div className="grid gap-3 sm:grid-cols-2">
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
    </div>
  );
}

// ── Tarjeta ─────────────────────────────────────────────────

/**
 * La portada grande, en 16:9 de verdad.
 *
 * `youTubeThumbnail` devuelve `hqdefault`, que viene en 4:3 con bandas negras:
 * bien para un cuadradito de 64px, pobre para una tarjeta ancha. Esta no existe
 * para todos los videos, así que la tarjeta cae de vuelta en la chica si falla.
 */
function youTubeCover(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}

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
  /** La portada grande no existe para todos los videos; se cae a la chica. */
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const thumbnail = videoId
    ? thumbnailFailed
      ? youTubeThumbnail(videoId)
      : youTubeCover(videoId)
    : item.content_thumbnail;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/60 bg-background/40",
        "transition-colors hover:border-border"
      )}
    >
      {/* Portada — es el botón de reproducir */}
      <button
        onClick={onStart}
        aria-label={`Ver ${item.content_title ?? "el video guardado"}`}
        className="relative block w-full aspect-video overflow-hidden bg-muted"
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            onError={() => setThumbnailFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl">
            {CONTENT_TYPE_CONFIG[item.content_type]?.emoji ?? "✨"}
          </div>
        )}

        {/* Velo y play. En el teléfono no hay hover, así que se ve siempre. */}
        <span className="absolute inset-0 bg-foreground/25 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200" />
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            "transition-all duration-200",
            "sm:opacity-0 sm:scale-90 sm:group-hover:opacity-100 sm:group-hover:scale-100"
          )}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-background/90 shadow-lg backdrop-blur-sm">
            <Play className="h-5 w-5 translate-x-[1px] fill-current text-foreground" />
          </span>
        </span>

        {/* Largo del video */}
        {item.content_duration_seconds ? (
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {formatClock(item.content_duration_seconds)}
          </span>
        ) : null}
      </button>

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
