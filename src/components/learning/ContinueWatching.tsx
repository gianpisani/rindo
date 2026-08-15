import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Play, X } from "lucide-react";
import { CONTENT_TYPE_CONFIG, contentProgress } from "@/lib/learning-config";
import type { SessionWithItemCount } from "@/hooks/useLearningSessions";

interface ContinueWatchingProps {
  unfinished: SessionWithItemCount[];
  onContinue: (session: SessionWithItemCount) => void;
  onDismiss: (session: SessionWithItemCount) => void;
}

/**
 * Contenido que dejaste a medias.
 *
 * Dejar un video a la mitad es perfectamente válido —esa sesión ya contó con
 * su tiempo y su comprensión— así que esto no es una tarea pendiente ni una
 * culpa: es solo un atajo para retomarlo donde ibas.
 */
export function ContinueWatching({
  unfinished,
  onContinue,
  onDismiss,
}: ContinueWatchingProps) {
  if (unfinished.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">
        Seguir viendo
      </p>

      <div className="space-y-1.5">
        {unfinished.slice(0, 3).map((session) => {
          const progress = contentProgress(session);

          return (
            <div
              key={session.id}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-2.5 py-2 -mx-1",
                "transition-colors hover:bg-muted/50"
              )}
            >
              <div className="relative h-10 w-16 shrink-0">
                {session.content_thumbnail ? (
                  <img
                    src={session.content_thumbnail}
                    alt=""
                    className="h-full w-full rounded-lg object-cover border border-border/50"
                  />
                ) : (
                  <div className="h-full w-full rounded-lg bg-muted flex items-center justify-center text-base">
                    {CONTENT_TYPE_CONFIG[session.content_type]?.emoji ?? "✨"}
                  </div>
                )}

                {progress.ratio !== null && (
                  <div className="absolute inset-x-1 bottom-1 h-1 rounded-full bg-black/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(progress.percent ?? 0, 3)}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {session.content_title ?? "Sesión"}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {progress.label}
                  {progress.percent !== null && ` · ${progress.percent}%`}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  onClick={() => onContinue(session)}
                  size="sm"
                  className="rounded-lg h-8 px-2.5"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                </Button>
                <Button
                  onClick={() => onDismiss(session)}
                  variant="ghost"
                  size="sm"
                  aria-label="No seguir con este"
                  title="Marcar como terminado"
                  className="rounded-lg h-8 px-2 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
