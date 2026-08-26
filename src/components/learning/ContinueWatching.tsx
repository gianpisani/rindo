import { cn } from "@/lib/utils";
import { X, History } from "lucide-react";
import { contentProgress } from "@/lib/learning-config";
import type {
  LearningSession,
  SessionWithItemCount,
} from "@/hooks/useLearningSessions";
import { ContentCover } from "./ContentCover";
import { ShelfSection } from "./ShelfSection";
import { useShelfOpen } from "@/hooks/useShelfOpen";

interface ContinueWatchingProps {
  unfinished: SessionWithItemCount[];
  /**
   * La sesión que dejaste abierta al salir del estudio. Va primera y marcada:
   * es la única que todavía tiene el reloj esperándote.
   */
  openSession?: LearningSession | null;
  onReturnToOpen?: () => void;
  onContinue: (session: SessionWithItemCount) => void;
  onDismiss: (session: SessionWithItemCount) => void;
}

/** Lo que hay que saber de una tarjeta, venga de donde venga. */
interface Entry {
  session: LearningSession;
  /** Sesión abierta: salir no la cerró, volver la retoma tal cual. */
  live: boolean;
  onPlay: () => void;
  onDismiss?: () => void;
}

/**
 * Contenido que dejaste a medias.
 *
 * Dejar un video a la mitad es perfectamente válido —esa sesión ya contó con
 * su tiempo y su comprensión— así que esto no es una tarea pendiente ni una
 * culpa: es solo un atajo para retomarlo donde ibas. Por eso se ve igual que
 * la lista de "para ver después": son videos, no deberes.
 */
export function ContinueWatching({
  unfinished,
  openSession,
  onReturnToOpen,
  onContinue,
  onDismiss,
}: ContinueWatchingProps) {
  const [open, setOpen] = useShelfOpen("continue");

  const entries: Entry[] = [];

  if (openSession) {
    entries.push({
      session: openSession,
      live: true,
      onPlay: () => onReturnToOpen?.(),
    });
  }

  for (const session of unfinished) {
    // Si la sesión abierta es de este mismo video, esa manda: es la de ahora.
    if (
      openSession?.external_id &&
      session.external_id === openSession.external_id
    ) {
      continue;
    }
    entries.push({
      session,
      live: false,
      onPlay: () => onContinue(session),
      onDismiss: () => onDismiss(session),
    });
  }

  if (entries.length === 0) return null;

  return (
    <ShelfSection
      icon={<History className="h-4 w-4 text-primary" />}
      title="Seguir viendo"
      count={entries.length}
      open={open}
      onOpenChange={setOpen}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {entries.map((entry) => (
          <ContinueCard key={entry.session.id} entry={entry} />
        ))}
      </div>
    </ShelfSection>
  );
}

// ── Tarjeta ─────────────────────────────────────────────────

function ContinueCard({ entry }: { entry: Entry }) {
  const { session, live, onPlay, onDismiss } = entry;
  const progress = contentProgress(session);

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-background/40",
        "transition-colors",
        live
          ? "border-primary/40 hover:border-primary/60"
          : "border-border/60 hover:border-border"
      )}
    >
      <ContentCover
        externalId={session.external_id}
        thumbnail={session.content_thumbnail}
        contentType={session.content_type}
        title={session.content_title}
        durationSeconds={session.content_duration_seconds}
        progressPercent={progress.percent}
        ribbon={
          live ? (
            <span className="flex items-center gap-1 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
              <span className="size-1.5 rounded-full bg-primary-foreground animate-breathe" />
              en curso
            </span>
          ) : null
        }
        onPlay={onPlay}
      />

      {/* Sacarlo de acá: darlo por terminado sin tener que verlo */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="No seguir con este"
          title="Marcar como terminado"
          className={cn(
            "absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-lg",
            "bg-background/80 text-muted-foreground backdrop-blur-sm",
            "opacity-0 transition-opacity hover:text-destructive",
            "group-hover:opacity-100 focus-visible:opacity-100"
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="p-3">
        <p className="text-sm font-medium leading-snug line-clamp-2">
          {session.content_title ?? "Sesión"}
        </p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground tabular-nums">
          {progress.label ?? "Recién empezado"}
          {progress.percent !== null && ` · ${progress.percent}%`}
        </p>
      </div>
    </article>
  );
}
