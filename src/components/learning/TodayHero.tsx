import { Flame, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  contentProgress,
  formatDuration,
  youTubeThumbnail,
} from "@/lib/learning-config";
import type { LearningGoal } from "@/hooks/useLearningGoals";
import type { LearningSession } from "@/hooks/useLearningSessions";
import type { LearningStats } from "@/hooks/useLearningStats";
import { ContentCover, LiveBadge } from "./ContentCover";

interface TodayHeroProps {
  goal: LearningGoal;
  stats: LearningStats;
  /** Lo que te está esperando: la sesión abierta o lo último que dejaste a medias. */
  featured: LearningSession | null;
  /** La destacada sigue abierta: volver la retoma tal cual, no abre otra. */
  featuredIsLive: boolean;
  onResumeFeatured: () => void;
  onStart: () => void;
}

/**
 * La portada de Aprendizaje.
 *
 * La decisión que tomas al abrir esta vista no es "cómo voy" sino "qué veo
 * ahora", así que el contenido dejó de vivir dentro de una tarjeta gris y pasó
 * a ser el fondo: la portada de lo que dejaste a medias, difuminada, con los
 * minutos del día encima.
 *
 * No es decoración. Antes "te faltan 12 min" era un número abstracto y "volver
 * a la sesión" un botón en otra parte; juntos, el minuto que falta es *de este
 * video*, y eso es lo que hace que uno le dé play.
 */
export function TodayHero({
  goal,
  stats,
  featured,
  featuredIsLive,
  onResumeFeatured,
  onStart,
}: TodayHeroProps) {
  const todayMinutes = stats.today.effectiveSeconds / 60;
  const target = goal.daily_minutes_target;
  const ratio = target > 0 ? todayMinutes / target : 0;
  const goalMet = todayMinutes >= target;

  const progress = featured ? contentProgress(featured) : null;

  /**
   * De fondo va la miniatura chica: se ve desenfocada, así que la resolución
   * da lo mismo y esa sí existe para todos los videos.
   */
  const art = featured
    ? featured.external_id
      ? youTubeThumbnail(featured.external_id)
      : featured.content_thumbnail
    : null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card">
      {art && (
        <>
          <img
            src={art}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl opacity-50 dark:opacity-35"
          />
          {/* El velo deja pasar el color del video, no la imagen: los textos
              siguen siendo los del tema y se leen igual de día que de noche. */}
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background/90 to-background/60" />
        </>
      )}

      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6">
        {featured && (
          <div
            className={cn(
              "group relative shrink-0 overflow-hidden rounded-xl shadow-sm",
              "border border-border/50 sm:order-2 sm:w-[38%]"
            )}
          >
            <ContentCover
              externalId={featured.external_id}
              thumbnail={featured.content_thumbnail}
              contentType={featured.content_type}
              title={featured.content_title}
              durationSeconds={featured.content_duration_seconds}
              progressPercent={progress?.percent ?? null}
              ribbon={featuredIsLive ? <LiveBadge>en curso</LiveBadge> : null}
              onPlay={onResumeFeatured}
            />
          </div>
        )}

        <div className="min-w-0 flex-1 sm:order-1">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Hoy
              </p>
              <p className="mt-1 text-5xl font-bold leading-none tracking-tight tabular-nums sm:text-6xl">
                {Math.round(todayMinutes)}
                <span className="text-lg font-semibold text-muted-foreground sm:text-xl">
                  {" "}/ {target} min
                </span>
              </p>
            </div>

            <DayRing ratio={ratio} met={goalMet} streak={stats.streakDays} />
          </div>

          {featured && (
            <p className="mt-4 truncate text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {featured.content_title ?? "Sesión"}
              </span>
              {progress?.label && (
                <span className="tabular-nums"> · {progress.label}</span>
              )}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <Button
              onClick={featured ? onResumeFeatured : onStart}
              className="h-12 flex-1 rounded-xl text-base font-semibold"
            >
              <Play className="mr-2 h-5 w-5 fill-current" />
              {featuredIsLive
                ? "Volver a la sesión"
                : featured
                  ? "Seguir viendo"
                  : "Empezar sesión"}
            </Button>

            {/* Con una sesión abierta no se puede abrir otra: el reloj es uno. */}
            {featured && !featuredIsLive && (
              <Button
                onClick={onStart}
                variant="outline"
                className="h-12 rounded-xl px-3.5"
                title="Empezar con otro video"
                aria-label="Empezar con otro video"
              >
                <Plus className="h-5 w-5" />
              </Button>
            )}
          </div>

          {featuredIsLive && (
            <p className="mt-2.5 text-[11px] text-muted-foreground">
              Pausada · {formatDuration(featured!.effective_seconds)} estudiando
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ── El anillo del día ───────────────────────────────────────

const RING_SIZE = 72;
const RING_STROKE = 6;

/**
 * Los minutos de hoy como arco, y adentro la racha.
 *
 * Es un anillo y no una barra a propósito: la barra ya significa otra cosa en
 * esta vista —cuánto llevas de un video, en el borde de la portada— y repetir
 * la forma para dos ideas distintas es lo que vuelve ilegible una pantalla.
 * Cerrar el anillo es lo que alimenta el número de adentro.
 */
function DayRing({
  ratio,
  met,
  streak,
}: {
  ratio: number;
  met: boolean;
  streak: number;
}) {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(ratio, 0), 1);

  return (
    <div
      className="relative shrink-0"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          fill="none"
          strokeWidth={RING_STROKE}
          className="stroke-muted-foreground/20"
        />
        {clamped > 0 && (
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${circumference * clamped} ${circumference}`}
            className={cn(
              "transition-[stroke-dasharray] duration-700 ease-out",
              met ? "stroke-emerald-500" : "stroke-primary"
            )}
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Flame
          className={cn(
            "h-3.5 w-3.5",
            streak > 0 ? "text-primary" : "text-muted-foreground/40"
          )}
        />
        <span
          className={cn(
            "mt-0.5 text-sm font-bold leading-none tabular-nums",
            streak === 0 && "text-muted-foreground/50"
          )}
        >
          {streak}
        </span>
      </div>
    </div>
  );
}
