import type { MutableRefObject, ReactNode } from "react";
import {
  ArrowLeft,
  Captions,
  Highlighter,
  HelpCircle,
  List,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/learning-config";
import { useSmoothPosition, type PlaybackSample } from "@/hooks/useSmoothPosition";

export type StudioState = "studying" | "researching" | "paused";

/** Qué panel está abierto sobre la sala. Uno solo a la vez. */
export type StudioPanel = "captured" | "subtitles" | "session" | null;

/**
 * Los tres estados de una sesión, con su explicación.
 *
 * La distinción entre "investigando" y "pausada" es la idea central del
 * producto —parar el video para mirar una palabra sigue siendo estudiar— así
 * que la nota no es decoración: es lo que evita que pauses de más.
 */
export const STATE_CONFIG: Record<
  StudioState,
  { label: string; dot: string; text: string; note: string | null }
> = {
  studying: {
    label: "Estudiando",
    dot: "bg-emerald-500",
    text: "text-emerald-400",
    note: null,
  },
  researching: {
    label: "Investigando",
    dot: "bg-amber-500",
    text: "text-amber-400",
    note: "el reloj sigue: buscar una palabra también es estudiar",
  },
  paused: {
    label: "Pausada",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    note: "el tiempo está detenido, pero puedes seguir buscando palabras",
  },
};

/**
 * El botón de la sala. Uno solo para las dos barras.
 *
 * Sobre negro no hay tarjetas: lo que separa un control del video es que se
 * enciende al pasarle por encima, no un borde. El nombre viaja al lado del
 * icono cuando la pantalla da para eso, y si no queda en el `title` — pero
 * nunca desaparece del todo, que es lo que convierte una fila de iconos en un
 * acertijo.
 */
export function RailButton({
  icon,
  label,
  title,
  onClick,
  active,
  badge,
  tone = "ghost",
  hideLabel,
  className,
}: {
  icon: ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
  active?: boolean;
  badge?: number;
  tone?: "ghost" | "outline" | "primary";
  /** El nombre no se muestra nunca: el icono habla solo. */
  hideLabel?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title ?? label}
      aria-label={label}
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-xl px-2.5 transition-colors",
        "text-xs font-medium",
        tone === "ghost" &&
          (active
            ? "bg-foreground/[0.14] text-foreground"
            : "text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground"),
        tone === "outline" &&
          "border border-border/70 text-foreground/90 hover:border-border hover:bg-foreground/[0.08]",
        tone === "primary" &&
          "bg-primary text-primary-foreground hover:bg-primary/90",
        className
      )}
    >
      <span className="shrink-0">{icon}</span>
      {!hideLabel && <span className="hidden lg:inline">{label}</span>}
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            "shrink-0 rounded-md px-1 text-[10px] font-bold tabular-nums",
            active ? "bg-foreground/15" : "bg-foreground/10"
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/**
 * La barra de arriba: de dónde vienes, qué estás viendo y cuánto llevas.
 *
 * Vive en la franja negra sobre la pantalla, no encima de la imagen. Es la
 * única jerarquía que la sala necesita a la vista permanente —el resto son
 * acciones, y las acciones viven abajo.
 */
export function StudioTopRail({
  title,
  author,
  state,
  effectiveSeconds,
  onLeave,
}: {
  title: string | null;
  author: string | null;
  state: StudioState;
  effectiveSeconds: number;
  onLeave: () => void;
}) {
  const config = STATE_CONFIG[state];

  return (
    <div className="flex h-11 shrink-0 items-center gap-3 px-3 sm:px-5">
      <button
        onClick={onLeave}
        title="Salir del estudio — se guarda el minuto donde quedaste"
        className={cn(
          "group flex h-8 shrink-0 items-center gap-1.5 rounded-xl pl-1.5 pr-2.5",
          "text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden text-xs font-medium sm:inline">Salir</span>
        <kbd className="hidden rounded bg-foreground/10 px-1 font-mono text-[10px] lg:inline">
          Esc
        </kbd>
      </button>

      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <p className="min-w-0 truncate text-[13px] font-semibold text-foreground/90">
          {title ?? "Cargando…"}
        </p>
        {author && (
          <p className="hidden min-w-0 shrink truncate text-[11px] text-muted-foreground sm:block">
            {author}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <span
          title={config.note ?? undefined}
          className="flex items-center gap-1.5"
        >
          <span className="relative flex h-1.5 w-1.5">
            {state === "studying" && (
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                  config.dot
                )}
              />
            )}
            <span
              className={cn("relative h-1.5 w-1.5 rounded-full", config.dot)}
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
        </span>

        {config.note && (
          <span className="hidden max-w-[22rem] truncate text-[11px] text-muted-foreground xl:inline">
            {config.note}
          </span>
        )}

        <span className="flex items-baseline gap-1 border-l border-border/60 pl-2.5">
          <span className="text-[13px] font-bold tabular-nums text-foreground/90">
            {formatClock(effectiveSeconds)}
          </span>
          <span className="text-[10px] text-muted-foreground">efectivo</span>
        </span>
      </div>
    </div>
  );
}

/**
 * La barra de abajo: el reproductor y las cuatro cosas que se abren.
 *
 * Todo lo que antes era una columna de tarjetas permanente —la sesión, los
 * subtítulos, lo que llevas juntado— es acá un botón que abre un panel. No
 * porque estorbe: porque mientras escuchas no lo estás usando, y el alto que
 * ocupaba es exactamente el que le faltaba al video.
 */
export function StudioControlRail({
  playbackRef,
  playing,
  durationSeconds,
  onToggle,
  onRepeat,
  captionOn,
  onToggleCaption,
  hasSubtitles,
  capturedCount,
  onOpenCapture,
  isPaused,
  panel,
  onPanel,
  onHelp,
}: {
  playbackRef: MutableRefObject<PlaybackSample>;
  playing: boolean;
  durationSeconds: number;
  onToggle: () => void;
  onRepeat: () => void;
  captionOn: boolean;
  onToggleCaption: () => void;
  hasSubtitles: boolean;
  capturedCount: number;
  onOpenCapture: () => void;
  isPaused: boolean;
  panel: StudioPanel;
  onPanel: (panel: StudioPanel) => void;
  onHelp: () => void;
}) {
  const seconds = useSmoothPosition(playbackRef);

  const toggle = (next: Exclude<StudioPanel, null>) =>
    onPanel(panel === next ? null : next);

  return (
    <div className="flex h-12 shrink-0 items-center gap-1 px-3 sm:px-5">
      <button
        onClick={onToggle}
        title={playing ? "Pausar el video (Espacio)" : "Reproducir (Espacio)"}
        aria-label={playing ? "Pausar el video" : "Reproducir"}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          "text-foreground/90 transition-colors hover:bg-foreground/[0.08]"
        )}
      >
        {playing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 translate-x-[1px] fill-current" />
        )}
      </button>

      <RailButton
        icon={<RotateCcw className="h-4 w-4" />}
        label="Repetir"
        title="Repetir la frase que acaba de sonar (R)"
        onClick={onRepeat}
        hideLabel
      />

      {hasSubtitles && (
        <RailButton
          icon={<Captions className="h-4 w-4" />}
          label="Subtítulo"
          title={
            captionOn
              ? "Esconder el subtítulo sobre el video (C)"
              : "Mostrar el subtítulo sobre el video (C)"
          }
          onClick={onToggleCaption}
          active={captionOn}
          hideLabel
        />
      )}

      <span className="ml-1.5 shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
        {formatClock(seconds)}
        <span className="text-muted-foreground/50">
          {" / "}
          {formatClock(durationSeconds)}
        </span>
      </span>

      <div className="flex-1" />

      <RailButton
        icon={<Plus className="h-4 w-4" />}
        label={isPaused ? "Buscar" : "Nueva expresión"}
        title={
          isPaused
            ? "Buscar una palabra sin guardarla (E)"
            : "Escribir una expresión a mano (E)"
        }
        onClick={onOpenCapture}
        tone="outline"
      />

      <RailButton
        icon={<Highlighter className="h-4 w-4" />}
        label="Capturadas"
        title="Lo que llevas juntado en esta sesión"
        onClick={() => toggle("captured")}
        active={panel === "captured"}
        badge={capturedCount}
      />

      <RailButton
        icon={<List className="h-4 w-4" />}
        label="Subtítulos"
        title="La transcripción y qué hacer con ella"
        onClick={() => toggle("subtitles")}
        active={panel === "subtitles"}
      />

      <RailButton
        icon={<MoreHorizontal className="h-4 w-4" />}
        label="La sesión"
        title="Terminar, pausar o descartar la sesión"
        onClick={() => toggle("session")}
        active={panel === "session"}
      />

      <RailButton
        icon={<HelpCircle className="h-4 w-4" />}
        label="Atajos"
        title="Cómo se maneja esto"
        onClick={onHelp}
        hideLabel
      />
    </div>
  );
}
