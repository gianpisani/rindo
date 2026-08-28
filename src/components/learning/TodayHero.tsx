import { Check, Flame, Play, Plus } from "lucide-react";
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
 * La portada de Aprendizaje, en una banda.
 *
 * Era un bloque alto con la portada de fondo, el número gigante y el botón
 * debajo. Se veía bien y costaba doscientos píxeles de alto en una página que
 * ya tiene dos parrillas de video: apilaba en vertical lo que cabe de sobra en
 * una fila.
 *
 * Ahora es una sola línea que se lee de izquierda a derecha, que es como se
 * lee una frase: cuánto llevas hoy, qué te está esperando, y el botón para
 * entrar. La portada del video sigue de fondo, difuminada, porque eso no
 * ocupaba alto: ocupaba carácter.
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
  const missingMinutes = Math.max(0, Math.ceil(target - todayMinutes));

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
            className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl opacity-45 dark:opacity-30"
          />
          {/* El velo deja pasar el color del video, no la imagen: los textos
              siguen siendo los del tema y se leen igual de día que de noche. */}
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background/90 to-background/60" />
        </>
      )}

      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
        {/* ── Hoy ────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-3">
          <DayRing ratio={ratio} met={goalMet} streak={stats.streakDays} />

          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Hoy
            </p>
            <p className="mt-0.5 text-2xl font-bold leading-none tracking-tight tabular-nums sm:text-3xl">
              {Math.round(todayMinutes)}
              <span className="text-base font-semibold text-muted-foreground">
                {" "}/ {target} min
              </span>
            </p>
          </div>
        </div>

        {/* ── Lo que te espera ───────────────────────────── */}
        {featured ? (
          <button
            onClick={onResumeFeatured}
            className={cn(
              "-m-1 flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left",
              "transition-colors hover:bg-muted/50"
            )}
          >
            <span className="relative aspect-video w-[5.5rem] shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted">
              {art ? (
                <img src={art} alt="" className="h-full w-full object-cover" />
              ) : null}

              {progress?.percent != null && (
                <span className="absolute inset-x-0 bottom-0 h-[3px] bg-black/40">
                  <span
                    className="block h-full bg-primary"
                    style={{ width: `${Math.max(progress.percent, 2)}%` }}
                  />
                </span>
              )}

              {featuredIsLive && (
                <span className="absolute left-1 top-1 size-1.5 rounded-full bg-primary ring-2 ring-black/40" />
              )}
            </span>

            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {featured.content_title ?? "Sesión"}
              </span>
              <span className="block truncate text-[11px] tabular-nums text-muted-foreground">
                {featuredIsLive
                  ? `En pausa · ${formatDuration(featured.effective_seconds)} estudiando`
                  : (progress?.label ?? "Recién empezado")}
              </span>
            </span>
          </button>
        ) : (
          /* Sin nada a medias el hueco dice lo único que falta saber */
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {goalMet ? (
              <span className="flex items-center gap-1.5 font-medium text-emerald-500">
                <Check className="h-4 w-4" />
                Meta del día cumplida
              </span>
            ) : (
              `Te faltan ${missingMinutes} min para cerrar el día`
            )}
          </p>
        )}

        {/* ── Entrar ─────────────────────────────────────── */}
        <div className="flex w-full shrink-0 items-center gap-2 sm:ml-auto sm:w-auto">
          {/* Con una sesión abierta no se puede abrir otra: el reloj es uno. */}
          {featured && !featuredIsLive && (
            <Button
              onClick={onStart}
              variant="outline"
              className="h-11 rounded-xl px-3"
              title="Empezar con otro video"
              aria-label="Empezar con otro video"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}

          <Button
            onClick={featured ? onResumeFeatured : onStart}
            className="h-11 flex-1 rounded-xl px-5 font-semibold sm:flex-none"
          >
            <Play className="mr-2 h-4 w-4 fill-current" />
            {featuredIsLive
              ? "Volver a la sesión"
              : featured
                ? "Seguir viendo"
                : "Empezar sesión"}
          </Button>
        </div>
      </div>
    </section>
  );
}

// ── El anillo del día ───────────────────────────────────────

const RING_SIZE = 48;
const RING_STROKE = 4.5;

/**
 * Los minutos de hoy como arco, y adentro la racha.
 *
 * Es un anillo y no una barra a propósito: la barra ya significa otra cosa en
 * esta página —cuánto llevas de un video, en el borde de la portada— y repetir
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
      title={`${Math.round(clamped * 100)}% de la meta de hoy${
        streak > 0 ? ` · ${streak} días seguidos` : ""
      }`}
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
            "h-3 w-3",
            streak > 0 ? "text-primary" : "text-muted-foreground/40"
          )}
        />
        <span
          className={cn(
            "text-[11px] font-bold leading-none tabular-nums",
            streak === 0 && "text-muted-foreground/50"
          )}
        >
          {streak}
        </span>
      </div>
    </div>
  );
}
