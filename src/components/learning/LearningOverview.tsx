import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Play, Flame, Check } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  MAX_COMPREHENSION,
  comprehensionScore,
  formatDuration,
  CONTENT_TYPE_CONFIG,
} from "@/lib/learning-config";
import type { LearningGoal } from "@/hooks/useLearningGoals";
import type {
  LearningSession,
  SessionWithItemCount,
} from "@/hooks/useLearningSessions";
import type { LearningStats } from "@/hooks/useLearningStats";

interface LearningOverviewProps {
  goal: LearningGoal;
  stats: LearningStats;
  sessions: SessionWithItemCount[];
  onStart: () => void;
  /** Sesión abierta que quedó pausada al salir del estudio. */
  openSession?: LearningSession | null;
  onReturnToSession?: () => void;
  onOpenSession: (session: SessionWithItemCount) => void;
  /** La lista de "para ver después" se renderiza entre hoy y la semana. */
  queueSlot?: ReactNode;
  /** Contenido a medias, justo bajo la meta del día. */
  continueSlot?: ReactNode;
}

function WeekStat({
  value,
  label,
  muted,
}: {
  value: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          "text-xl font-bold tabular-nums leading-none",
          muted && "text-muted-foreground"
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

export function LearningOverview({
  goal,
  stats,
  sessions,
  onStart,
  openSession,
  onReturnToSession,
  onOpenSession,
  queueSlot,
  continueSlot,
}: LearningOverviewProps) {
  const todayMinutes = stats.today.effectiveSeconds / 60;
  const target = goal.daily_minutes_target;
  const progress = Math.min(todayMinutes / target, 1);
  const goalMet = todayMinutes >= target;

  const recent = sessions.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* ── Hoy ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Hoy
            </p>
            <p className="mt-1.5 text-3xl font-bold tabular-nums leading-none">
              {Math.round(todayMinutes)}
              <span className="text-lg text-muted-foreground font-semibold">
                {" "}/ {target} min
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {stats.streakDays > 0 && (
              <div className="flex items-center gap-1.5 text-primary">
                <Flame className="h-4 w-4" />
                <span className="text-sm font-bold tabular-nums">
                  {stats.streakDays}
                </span>
              </div>
            )}
            {goalMet && (
              <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <Check className="h-4 w-4 text-emerald-500" />
              </div>
            )}
          </div>
        </div>

        {/* Barra */}
        <div className="mt-4 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              goalMet ? "bg-emerald-500" : "bg-primary"
            )}
            style={{ width: `${Math.max(progress * 100, progress > 0 ? 4 : 0)}%` }}
          />
        </div>

        {/* Acción principal */}
        {openSession ? (
          <button
            onClick={onReturnToSession}
            className={cn(
              "w-full mt-5 rounded-xl border border-primary/30 bg-primary/[0.07]",
              "px-4 py-3 flex items-center gap-3 text-left",
              "hover:bg-primary/10 transition-colors"
            )}
          >
            <div className="flex items-center justify-center size-10 rounded-full bg-primary/15 text-primary shrink-0">
              <Play className="h-4 w-4 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">
                Volver a la sesión
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {openSession.content_title ?? "En pausa"} ·{" "}
                {formatDuration(openSession.effective_seconds)} estudiando
              </p>
            </div>
          </button>
        ) : (
          <Button
            onClick={onStart}
            className="w-full mt-5 h-14 text-base font-semibold rounded-xl"
          >
            <Play className="h-5 w-5 mr-2 fill-current" />
            Empezar sesión
          </Button>
        )}
      </div>

      {/* ── Seguir viendo ────────────────────────────────── */}
      {continueSlot}

      {/* ── Para ver después ─────────────────────────────── */}
      {queueSlot}

      {/* ── Esta semana ──────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-4">
          Esta semana
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <WeekStat
            value={formatDuration(stats.thisWeek.effectiveSeconds)}
            label="estudiando"
          />
          <WeekStat
            value={String(stats.thisWeek.sessionCount)}
            label={stats.thisWeek.sessionCount === 1 ? "sesión" : "sesiones"}
          />
          <WeekStat
            value={String(stats.thisWeek.newItems)}
            label="expresiones"
          />
          <WeekStat
            value={
              stats.thisWeek.comprehension !== null
                ? `${stats.thisWeek.comprehension.toFixed(1)}`
                : "—"
            }
            label={`comprensión /${MAX_COMPREHENSION}`}
            muted={stats.thisWeek.comprehension === null}
          />
        </div>
      </div>

      {/* ── Últimas sesiones ─────────────────────────────── */}
      {recent.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">
            Últimas sesiones
          </p>

          <div className="space-y-1.5">
            {recent.map((s) => (
              <button
                key={s.id}
                onClick={() => onOpenSession(s)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl px-2.5 py-2 -mx-1",
                  "transition-colors hover:bg-muted/50 text-left"
                )}
              >
                {s.content_thumbnail ? (
                  <img
                    src={s.content_thumbnail}
                    alt=""
                    className="h-10 w-16 rounded-lg object-cover border border-border/50 shrink-0"
                  />
                ) : (
                  <div className="h-10 w-16 rounded-lg bg-muted flex items-center justify-center shrink-0 text-base">
                    {CONTENT_TYPE_CONFIG[s.content_type]?.emoji ?? "✨"}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {s.content_title ?? "Sesión"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(s.started_at), "d MMM", { locale: es })} ·{" "}
                    {formatDuration(s.effective_seconds)}
                    {s.new_item_count > 0 && ` · ${s.new_item_count} nuevas`}
                  </p>
                </div>

                <span className="text-sm font-bold tabular-nums text-muted-foreground shrink-0">
                  {comprehensionScore(s) ?? "—"}
                  <span className="text-[10px] font-normal">/{MAX_COMPREHENSION}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {sessions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
          <p className="text-sm font-medium">Todavía no hay sesiones</p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
            Pega el link de un video en inglés y empieza. El resto lo mide Rindo.
          </p>
        </div>
      )}
    </div>
  );
}
