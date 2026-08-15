import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BaseModal } from "@/components/BaseModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ExternalLink, Trash2 } from "lucide-react";
import {
  CONTENT_TYPE_CONFIG,
  DIFFICULTY_CONFIG,
  MAX_COMPREHENSION,
  comprehensionScore,
  contentProgress,
  formatClock,
  formatDuration,
  sessionMetrics,
  youTubeWatchUrl,
} from "@/lib/learning-config";
import type { SessionWithItemCount } from "@/hooks/useLearningSessions";
import { useSessionItems } from "@/hooks/useLearningItems";

interface LearningSessionsListProps {
  sessions: SessionWithItemCount[];
  selected: SessionWithItemCount | null;
  onSelect: (session: SessionWithItemCount | null) => void;
  onDelete: (id: string) => void;
}

export function LearningSessionsList({
  sessions,
  selected,
  onSelect,
  onDelete,
}: LearningSessionsListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Las sesiones que termines aparecen acá.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {sessions.map((s) => {
          const score = comprehensionScore(s);
          const difficulty = s.difficulty ? DIFFICULTY_CONFIG[s.difficulty] : null;
          const progress = contentProgress(s);

          return (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              className={cn(
                "w-full flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3",
                "transition-all hover:border-primary/20 hover:shadow-sm text-left"
              )}
            >
              <div className="relative h-14 w-24 shrink-0">
                {s.content_thumbnail ? (
                  <img
                    src={s.content_thumbnail}
                    alt=""
                    className="h-full w-full rounded-xl object-cover border border-border/50"
                  />
                ) : (
                  <div className="h-full w-full rounded-xl bg-muted flex items-center justify-center text-xl">
                    {CONTENT_TYPE_CONFIG[s.content_type]?.emoji ?? "✨"}
                  </div>
                )}

                {progress.ratio !== null && (
                  <div className="absolute inset-x-1 bottom-1 h-1 rounded-full bg-black/50 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        progress.isComplete ? "bg-emerald-500" : "bg-primary"
                      )}
                      style={{ width: `${Math.max(progress.percent ?? 0, 3)}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">
                  {s.content_title ?? "Sesión"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {s.content_author ?? CONTENT_TYPE_CONFIG[s.content_type]?.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                  {format(new Date(s.started_at), "d MMM", { locale: es })} ·{" "}
                  {formatDuration(s.effective_seconds)}
                  {s.new_item_count > 0 && ` · ${s.new_item_count} nuevas`}
                </p>
                {progress.label && (
                  <p className="text-[11px] tabular-nums mt-0.5">
                    <span
                      className={cn(
                        progress.isComplete ? "text-emerald-500" : "text-primary"
                      )}
                    >
                      {progress.label}
                    </span>
                    {progress.percent !== null && (
                      <span className="text-muted-foreground">
                        {" · "}
                        {progress.isComplete ? "visto entero" : `${progress.percent}%`}
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div className="text-right shrink-0">
                <p className="text-lg font-bold tabular-nums leading-none">
                  {score ?? "—"}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    /{MAX_COMPREHENSION}
                  </span>
                </p>
                {difficulty && (
                  <span className="text-[10px] text-muted-foreground">
                    {difficulty.emoji}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Detalle */}
      {selected && (
        <SessionDetailModal
          session={selected}
          open={!!selected}
          onOpenChange={(open) => !open && onSelect(null)}
          onRequestDelete={() => setConfirmDelete(selected.id)}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            onDelete(confirmDelete);
            onSelect(null);
          }
          setConfirmDelete(null);
        }}
        title="¿Eliminar la sesión?"
        description="Se borra el registro de tiempo y comprensión. Las expresiones capturadas se mantienen."
        confirmText="Eliminar"
      />
    </>
  );
}

// ── Detalle de una sesión ───────────────────────────────────

function DetailStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold tabular-nums leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function SessionDetailModal({
  session,
  open,
  onOpenChange,
  onRequestDelete,
}: {
  session: SessionWithItemCount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestDelete: () => void;
}) {
  const { data: captured = [] } = useSessionItems(session.id);
  const metrics = sessionMetrics(session, session.new_item_count);
  const difficulty = session.difficulty ? DIFFICULTY_CONFIG[session.difficulty] : null;

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title={session.content_title ?? "Sesión"}
      description={format(new Date(session.started_at), "EEEE d 'de' MMMM", {
        locale: es,
      })}
      maxWidth="lg"
    >
      <div className="space-y-5">
        {session.content_thumbnail && (
          <img
            src={session.content_thumbnail}
            alt=""
            className="w-full aspect-video object-cover rounded-xl border border-border/50"
          />
        )}

        {/* Métricas */}
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <DetailStat
              value={`${metrics.comprehension ?? "—"}/${MAX_COMPREHENSION}`}
              label="comprensión"
            />
            <DetailStat
              value={String(session.new_item_count)}
              label="expresiones"
            />
            <DetailStat
              value={formatDuration(session.effective_seconds)}
              label="estudiando"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/50">
            <DetailStat
              value={
                session.content_duration_seconds
                  ? formatDuration(session.content_duration_seconds)
                  : "—"
              }
              label="contenido"
            />
            <DetailStat
              value={
                metrics.studyMultiplier
                  ? `${metrics.studyMultiplier.toFixed(2)}x`
                  : "—"
              }
              label="multiplicador"
            />
            <DetailStat
              value={
                metrics.focusRatio ? `${Math.round(metrics.focusRatio * 100)}%` : "—"
              }
              label="foco"
            />
          </div>
        </div>

        {difficulty && (
          <div className="flex justify-center">
            <span
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border",
                difficulty.border,
                difficulty.bg
              )}
            >
              {difficulty.emoji} {difficulty.label}
            </span>
          </div>
        )}

        {/* Idea principal */}
        {session.main_idea_text && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              La idea principal, según tú
            </p>
            <p className="text-sm leading-relaxed rounded-xl bg-muted/30 border border-border/50 p-3">
              {session.main_idea_text}
            </p>
          </div>
        )}

        {/* Expresiones */}
        {captured.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Lo que capturaste
            </p>
            <div className="space-y-1.5">
              {captured.map((item) => (
                <div
                  key={item.sighting_id}
                  className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{item.expression}</span>
                    {item.timestamp_seconds !== null && session.external_id ? (
                      <a
                        href={youTubeWatchUrl(session.external_id, item.timestamp_seconds)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-muted-foreground hover:text-primary tabular-nums shrink-0 flex items-center gap-1"
                      >
                        {formatClock(item.timestamp_seconds)}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ) : item.timestamp_seconds !== null ? (
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                        {formatClock(item.timestamp_seconds)}
                      </span>
                    ) : null}
                  </div>
                  {item.context && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">
                      “{item.context}”
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          {session.content_url && (
            <Button variant="outline" size="sm" asChild className="rounded-xl">
              <a href={session.content_url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Abrir contenido
              </a>
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onRequestDelete}
            className="rounded-xl text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Eliminar
          </Button>
        </div>
      </div>
    </BaseModal>
  );
}
