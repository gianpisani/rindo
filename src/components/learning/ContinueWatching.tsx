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
   * Lo que ya está arriba en el héroe. No se repite acá: decirlo dos veces en
   * la misma pantalla es lo que hacía que la vista se sintiera un formulario.
   */
  featured?: LearningSession | null;
  onContinue: (session: SessionWithItemCount) => void;
  onDismiss: (session: SessionWithItemCount) => void;
}

/**
 * Contenido que dejaste a medias.
 *
 * Dejar un video a la mitad es perfectamente válido —esa sesión ya contó con
 * su tiempo y su comprensión— así que esto no es una tarea pendiente ni una
 * culpa: es solo un atajo para retomarlo donde ibas.
 *
 * Va en fila que corre y no en parrilla, aunque las tarjetas midan exactamente
 * lo mismo que las de "para ver después": son dos estanterías seguidas de
 * miniaturas y, sin un gesto distinto, se leían como una sola lista larga.
 */
export function ContinueWatching({
  unfinished,
  featured,
  onContinue,
  onDismiss,
}: ContinueWatchingProps) {
  const [open, setOpen] = useShelfOpen("continue");

  const rest = unfinished.filter(
    (s) =>
      s.id !== featured?.id &&
      // Mismo video que el del héroe, de una sesión anterior: ya está arriba.
      !(featured?.external_id && s.external_id === featured.external_id)
  );

  if (rest.length === 0) return null;

  return (
    <ShelfSection
      icon={<History className="h-4 w-4 text-primary" />}
      title="Seguir viendo"
      count={rest.length}
      open={open}
      onOpenChange={setOpen}
    >
      <div
        className={cn(
          "-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1",
          "no-scrollbar scroll-smooth"
        )}
      >
        {rest.map((session) => (
          <ContinueCard
            key={session.id}
            session={session}
            onContinue={() => onContinue(session)}
            onDismiss={() => onDismiss(session)}
          />
        ))}
      </div>
    </ShelfSection>
  );
}

// ── Tarjeta ─────────────────────────────────────────────────

function ContinueCard({
  session,
  onContinue,
  onDismiss,
}: {
  session: SessionWithItemCount;
  onContinue: () => void;
  onDismiss: () => void;
}) {
  const progress = contentProgress(session);

  return (
    <article
      className={cn(
        "group relative shrink-0 snap-start overflow-hidden rounded-xl",
        "border border-border/60 bg-background/40 transition-colors hover:border-border",
        // Mide igual que una tarjeta de la parrilla de tres: la fila corre,
        // pero las dos estanterías siguen alineadas.
        "w-[46%] sm:w-[calc((100%-1.5rem)/3)]"
      )}
    >
      <ContentCover
        externalId={session.external_id}
        thumbnail={session.content_thumbnail}
        contentType={session.content_type}
        title={session.content_title}
        durationSeconds={session.content_duration_seconds}
        progressPercent={progress.percent}
        onPlay={onContinue}
      />

      {/* Sacarlo de acá: darlo por terminado sin tener que verlo */}
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

      <div className="p-3">
        <p className="text-sm font-medium leading-snug line-clamp-2">
          {session.content_title ?? "Sesión"}
        </p>
        <p className="mt-1 truncate text-[11px] tabular-nums text-muted-foreground">
          {progress.label ?? "Recién empezado"}
          {progress.percent !== null && ` · ${progress.percent}%`}
        </p>
      </div>
    </article>
  );
}
