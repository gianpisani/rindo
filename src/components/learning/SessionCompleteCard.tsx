import { BaseModal } from "@/components/BaseModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Flame, Check } from "lucide-react";
import {
  DIFFICULTY_CONFIG,
  MAX_COMPREHENSION,
  formatDuration,
  sessionMetrics,
} from "@/lib/learning-config";
import type { LearningSession } from "@/hooks/useLearningSessions";
import { useSessionItems } from "@/hooks/useLearningItems";

interface SessionCompleteCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: LearningSession;
  /** Minutos efectivos acumulados hoy, incluyendo esta sesión. */
  todayMinutes: number;
  dailyTargetMinutes: number;
  streakDays: number;
}

function Stat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <p
        className={cn(
          "text-2xl font-bold tabular-nums leading-none",
          accent && "text-primary"
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

export function SessionCompleteCard({
  open,
  onOpenChange,
  session,
  todayMinutes,
  dailyTargetMinutes,
  streakDays,
}: SessionCompleteCardProps) {
  const { data: captured = [] } = useSessionItems(session.id);
  const newCount = captured.filter((c) => c.is_new).length;
  const metrics = sessionMetrics(session, newCount);

  const goalMet = todayMinutes >= dailyTargetMinutes;
  const difficulty = session.difficulty ? DIFFICULTY_CONFIG[session.difficulty] : null;

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title="Sesión lista"
      maxWidth="lg"
      footer={
        <Button
          onClick={() => onOpenChange(false)}
          className="w-full h-12 text-base font-semibold rounded-xl"
        >
          Listo
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Contenido */}
        <div className="flex items-center gap-3">
          {session.content_thumbnail && (
            <img
              src={session.content_thumbnail}
              alt=""
              className="h-14 w-24 rounded-lg object-cover border border-border/50 shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">
              {session.content_title ?? "Sesión"}
            </p>
            {session.content_author && (
              <p className="text-xs text-muted-foreground truncate">
                {session.content_author}
              </p>
            )}
          </div>
        </div>

        {/* Lo importante: comprensión y vocabulario */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-3xl font-bold text-primary tabular-nums leading-none">
              {metrics.comprehension ?? "—"}
              <span className="text-lg text-primary/50">/{MAX_COMPREHENSION}</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1.5">comprensión</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4 text-center">
            <p className="text-3xl font-bold tabular-nums leading-none">{newCount}</p>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {newCount === 1 ? "expresión nueva" : "expresiones nuevas"}
            </p>
          </div>
        </div>

        {/* Contexto de la sesión */}
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat value={formatDuration(session.effective_seconds)} label="estudiando" />
            <Stat
              value={
                session.content_duration_seconds
                  ? formatDuration(session.content_duration_seconds)
                  : "—"
              }
              label="de contenido"
            />
            <Stat
              value={formatDuration(session.elapsed_seconds ?? 0)}
              label="transcurrido"
            />
          </div>

          {(metrics.studyMultiplier || metrics.focusRatio) && (
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border/50">
              <Stat
                value={
                  metrics.studyMultiplier
                    ? `${metrics.studyMultiplier.toFixed(2)}x`
                    : "—"
                }
                label="multiplicador"
              />
              <Stat
                value={
                  metrics.focusRatio
                    ? `${Math.round(metrics.focusRatio * 100)}%`
                    : "—"
                }
                label="foco"
              />
            </div>
          )}
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

        {/* Meta del día */}
        <div
          className={cn(
            "rounded-2xl border p-4 flex items-center gap-3",
            goalMet
              ? "border-emerald-500/25 bg-emerald-500/5"
              : "border-border/60 bg-card"
          )}
        >
          {goalMet ? (
            <div className="h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Check className="h-4 w-4 text-emerald-500" />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
              <span className="text-xs font-bold tabular-nums">
                {Math.round((todayMinutes / dailyTargetMinutes) * 100)}%
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {goalMet ? "Meta del día cumplida" : "Vas en camino"}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {Math.round(todayMinutes)} / {dailyTargetMinutes} min efectivos hoy
            </p>
          </div>

          {streakDays > 1 && (
            <div className="flex items-center gap-1 text-primary shrink-0">
              <Flame className="h-4 w-4" />
              <span className="text-sm font-bold tabular-nums">{streakDays}</span>
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
