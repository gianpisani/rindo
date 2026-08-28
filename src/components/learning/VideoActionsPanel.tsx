import {
  ArrowLeft,
  ExternalLink,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
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
  /** Borrar todo rastro de este video: se usa cuando probaste algo. */
  onReset: () => void;
  canReset: boolean;
  /** El video sigue siendo de YouTube: la puerta de salida vive acá. */
  youtubeUrl?: string | null;
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
  onReset,
  canReset,
  youtubeUrl,
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
      <div className="flex items-baseline gap-2">
        {author && (
          <p className="min-w-0 truncate text-[11px] text-muted-foreground">
            {author}
          </p>
        )}
        {youtubeUrl && (
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noreferrer"
            title="Abrir en YouTube en el minuto donde vas"
            className="ml-auto flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
            YouTube
          </a>
        )}
      </div>

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

      {/*
        Todos del mismo porte y con su nombre escrito. Antes las dos salidas
        eran texto suelto bajo dos botones, y eso las hacía parecer notas al
        pie: son acciones, y una de ellas borra la sesión. Lo que jerarquiza es
        el color, no el tamaño.
      */}
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        {isPaused ? (
          <ActionButton
            onClick={onResume}
            icon={<Play className="h-3.5 w-3.5 fill-current" />}
            label="Reanudar"
            tone="primary"
          />
        ) : (
          <ActionButton
            onClick={onPause}
            icon={<Pause className="h-3.5 w-3.5" />}
            label="Pausar"
            tone="neutral"
          />
        )}

        <ActionButton
          onClick={onFinish}
          icon={<Flag className="h-3.5 w-3.5" />}
          label="Terminar"
          tone="accent"
        />

        <ActionButton
          onClick={onLeave}
          icon={<ArrowLeft className="h-3.5 w-3.5" />}
          label="Volver atrás"
          title="Se guarda el minuto donde quedaste"
          tone="muted"
        />

        <ActionButton
          onClick={onDiscard}
          icon={<Trash2 className="h-3.5 w-3.5" />}
          label="Descartar"
          title="Borrar esta sesión y su tiempo"
          tone="muted"
          danger
        />

        {canReset && (
          <ActionButton
            onClick={onReset}
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            label="Reiniciar video"
            title="Dejarlo como si nunca lo hubieras visto"
            tone="muted"
            danger
            wide
          />
        )}
      </div>
    </div>
  );
}

/**
 * El botón de esta tarjeta. Uno solo, con cuatro tonos.
 */
function ActionButton({
  onClick,
  icon,
  label,
  title,
  tone,
  danger,
  wide,
}: {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  title?: string;
  tone: "primary" | "accent" | "neutral" | "muted";
  danger?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-9 items-center justify-center gap-1.5 rounded-xl border text-xs font-medium",
        "transition-colors",
        tone === "primary" &&
          "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        tone === "accent" &&
          "border-primary/30 text-primary hover:bg-primary/10",
        tone === "neutral" && "border-border text-foreground hover:bg-muted",
        tone === "muted" &&
          "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
        danger && "hover:border-destructive/40 hover:text-destructive",
        wide && "col-span-2"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
