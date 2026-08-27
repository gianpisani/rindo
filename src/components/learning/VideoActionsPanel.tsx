import { ArrowLeft, Flag, Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatClock, formatDuration } from "@/lib/learning-config";

export type StudioState = "studying" | "researching" | "paused";

/**
 * Los tres estados de una sesión, con su explicación.
 *
 * La distinción entre "investigando" y "pausada" es la idea central del
 * producto —parar el video para mirar una palabra sigue siendo estudiar— así
 * que la nota no es decoración: es lo que evita que pauses de más.
 */
const STATE_CONFIG: Record<
  StudioState,
  { label: string; dot: string; text: string; ring: string; note: string | null }
> = {
  studying: {
    label: "Estudiando",
    dot: "bg-emerald-500",
    text: "text-emerald-500",
    ring: "border-emerald-500/25",
    note: null,
  },
  researching: {
    label: "Investigando",
    dot: "bg-amber-500",
    text: "text-amber-500",
    ring: "border-amber-500/25",
    note: "el reloj sigue: buscar una palabra también es estudiar",
  },
  paused: {
    label: "Pausada",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    ring: "border-border",
    note: "el tiempo está detenido, pero puedes seguir buscando palabras",
  },
};

interface VideoActionsPanelProps {
  state: StudioState;
  title: string | null;
  author: string | null;
  effectiveSeconds: number;
  elapsedSeconds: number;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onLeave: () => void;
  onDiscard: () => void;
}

/**
 * La sesión: en qué estado está, qué estás viendo, cuánto llevas y qué puedes
 * hacer con ella.
 *
 * Vivía en una franja sobre el video, robándole al video el alto que más falta
 * hace. Acá arriba de la columna ocupa espacio que igual estaba libre, y de
 * paso queda al lado de las otras dos cosas que se accionan —los subtítulos y
 * lo que capturas— en vez de repartido por la pantalla.
 */
export function VideoActionsPanel({
  state,
  title,
  author,
  effectiveSeconds,
  elapsedSeconds,
  isPaused,
  onPause,
  onResume,
  onFinish,
  onLeave,
  onDiscard,
}: VideoActionsPanelProps) {
  const config = STATE_CONFIG[state];

  return (
    <div
      className={cn(
        "shrink-0 rounded-2xl border bg-card p-4 transition-colors",
        config.ring
      )}
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {state === "studying" && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                config.dot
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex h-1.5 w-1.5 rounded-full",
              config.dot
            )}
          />
        </span>
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider",
            config.text
          )}
        >
          {config.label}
        </span>
      </div>

      {config.note && (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {config.note}
        </p>
      )}

      <p className="mt-2.5 line-clamp-2 font-semibold leading-tight">
        {title ?? "Cargando…"}
      </p>
      {author && (
        <p className="truncate text-[11px] text-muted-foreground">{author}</p>
      )}

      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-3xl font-bold leading-none tabular-nums">
          {formatClock(effectiveSeconds)}
        </p>
        <p className="text-[10px] leading-tight text-muted-foreground">
          efectivo
          <br />
          {formatDuration(elapsedSeconds)} total
        </p>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        {isPaused ? (
          <Button
            onClick={onResume}
            size="sm"
            className="h-9 rounded-xl font-semibold"
          >
            <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
            Reanudar
          </Button>
        ) : (
          <Button
            onClick={onPause}
            variant="outline"
            size="sm"
            className="h-9 rounded-xl font-medium"
          >
            <Pause className="mr-1.5 h-3.5 w-3.5" />
            Pausar
          </Button>
        )}

        <Button
          onClick={onFinish}
          variant="outline"
          size="sm"
          className="h-9 rounded-xl border-primary/30 font-medium text-primary hover:bg-primary/10 hover:text-primary"
        >
          <Flag className="mr-1.5 h-3.5 w-3.5" />
          Terminar
        </Button>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button
          onClick={onLeave}
          title="Se guarda el minuto donde quedaste"
          className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver sin terminar
        </button>

        <button
          onClick={onDiscard}
          className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Descartar
        </button>
      </div>
    </div>
  );
}
