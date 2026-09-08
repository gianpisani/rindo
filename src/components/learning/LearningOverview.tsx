import { cn } from "@/lib/utils";
import { Row, Panel } from "@/components/HairlineGrid";
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
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

/** Un dato de la semana. Celda de la franja: el rótulo arriba del número,
 *  como en Inicio, no debajo. */
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
    <Panel className="px-4 py-3 md:px-5">
      <p className="eyebrow truncate">{label}</p>
      <p
        className={cn(
          "mt-2 font-mono text-lg font-bold leading-none tracking-tight tabular-nums md:text-xl",
          muted && "text-muted-foreground"
        )}
      >
        {value}
      </p>
    </Panel>
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

  /* La pestaña es una columna de celdas: el gap de 1px del Row es la
     única separación. Antes era un space-y-4 entre tarjetas redondeadas
     flotando sobre el fondo. */
  return (
    <Row>
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

      {/* ── Esta semana. El rótulo del período en su propia banda y
          los cuatro datos como franja de celdas. ─────────────── */}
      <Panel className="px-4 py-2 md:px-5">
        <p className="eyebrow">Esta semana</p>
      </Panel>

      <Row className="grid-cols-2 sm:grid-cols-4">
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
      </Row>

      {/* ── Últimas sesiones. Lista de filas con línea entre ellas. */}
      {recent.length > 0 && (
        <Panel>
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 md:px-5">
            <h3 className="section-title text-xs">Últimas sesiones</h3>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {recent.length}
            </span>
          </div>

          {recent.map((s) => (
            <button
              key={s.id}
              onClick={() => onOpenSession(s)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-border px-4 py-2 text-left md:px-5",
                "transition-colors last:border-b-0 hover:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              )}
            >
              {s.content_thumbnail ? (
                <img
                  src={s.content_thumbnail}
                  alt=""
                  className="h-10 w-16 shrink-0 border border-border object-cover"
                />
              ) : (
                <div className="flex h-10 w-16 shrink-0 items-center justify-center border border-border bg-muted text-base">
                  {CONTENT_TYPE_CONFIG[s.content_type]?.emoji ?? "✨"}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {s.content_title ?? "Sesión"}
                </p>
                <p className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {format(new Date(s.started_at), "d MMM", { locale: es })} ·{" "}
                  {formatDuration(s.effective_seconds)}
                  {s.new_item_count > 0 && ` · ${s.new_item_count} nuevas`}
                </p>
              </div>

              <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-muted-foreground">
                {comprehensionScore(s) ?? "—"}
                <span className="text-[10px] font-normal">/{MAX_COMPREHENSION}</span>
              </span>
            </button>
          ))}
        </Panel>
      )}

      {/* Estado vacío */}
      {sessions.length === 0 && (
        <Panel className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
          <div className="flex size-14 items-center justify-center border border-border">
            <Sparkles className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="section-title text-sm">Todavía no hay sesiones</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Pega el link de un video en inglés y empieza. El resto lo mide Rindo.
          </p>
        </Panel>
      )}
    </Row>
  );
}
