import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  MAX_COMPREHENSION,
  comprehensionScore,
  formatDuration,
  CONTENT_TYPE_CONFIG,
} from "@/lib/learning-config";
import { TodayHero } from "./TodayHero";
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
  /** Lo que te está esperando: la sesión abierta o lo último a medias. */
  featured: LearningSession | null;
  /** La destacada sigue abierta: volver la retoma tal cual. */
  featuredIsLive: boolean;
  onResumeFeatured: () => void;
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
  featured,
  featuredIsLive,
  onResumeFeatured,
  onOpenSession,
  queueSlot,
  continueSlot,
}: LearningOverviewProps) {
  const recent = sessions.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* ── Hoy, sobre lo que estás viendo ───────────────── */}
      <TodayHero
        goal={goal}
        stats={stats}
        featured={featured}
        featuredIsLive={featuredIsLive}
        onResumeFeatured={onResumeFeatured}
        onStart={onStart}
      />

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
