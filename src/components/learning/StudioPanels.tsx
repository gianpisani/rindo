import type { ReactNode } from "react";
import {
  ArrowLeft,
  Crosshair,
  ExternalLink,
  Flag,
  List,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatClock, formatDuration } from "@/lib/learning-config";
import { STATE_CONFIG, type StudioState } from "./StudioChrome";
import type { SessionItem } from "@/hooks/useLearningItems";

/**
 * El panel de la sala: vidrio sobre negro, anclado a su botón de la barra.
 *
 * Los tres paneles comparten forma porque comparten rol: son la misma clase de
 * cosa —lo que antes vivía en tarjetas permanentes en una columna— y se abre
 * uno a la vez. Que se parezcan es lo que hace que abrir cualquiera no sea
 * aprender una pantalla nueva.
 */
function Panel({
  title,
  meta,
  onClose,
  children,
  className,
}: {
  title: string;
  meta?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "studio-glass flex w-[min(22rem,calc(100vw-1.5rem))] flex-col rounded-2xl",
        "max-h-[min(24rem,55vh)] overflow-hidden",
        className
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3.5 py-2.5">
        <h3 className="text-xs font-semibold">{title}</h3>
        {meta}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className={cn(
            "ml-auto flex size-6 shrink-0 items-center justify-center rounded-lg",
            "text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto p-3.5"
        onTouchMove={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * La acción de un panel. Todas del mismo porte y con su nombre escrito: lo que
 * jerarquiza es el color, no el tamaño.
 */
function PanelAction({
  onClick,
  icon,
  label,
  title,
  tone = "muted",
  active,
  danger,
}: {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  title?: string;
  tone?: "primary" | "accent" | "neutral" | "muted";
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-colors",
        tone === "primary" &&
          "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        tone === "accent" && "border-primary/30 text-primary hover:bg-primary/10",
        tone === "neutral" && "border-border text-foreground hover:bg-foreground/[0.08]",
        tone === "muted" &&
          (active
            ? "border-primary/30 text-primary hover:bg-primary/10"
            : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"),
        danger && "hover:border-destructive/40 hover:text-destructive"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Lo que llevas juntado ───────────────────────────────────

/**
 * Las expresiones de esta sesión, cada una con su minuto.
 *
 * Vivía en una columna permanente compitiendo con el video. Es una lista que se
 * consulta —"¿qué llevo?", "¿dónde dijo eso?"— y consultar es un momento, no
 * un estado: por eso ahora se abre y se cierra.
 */
export function CapturedPanel({
  items,
  onSeek,
  onClose,
}: {
  items: SessionItem[];
  onSeek: (seconds: number) => void;
  onClose: () => void;
}) {
  return (
    <Panel
      title="Lo que llevas"
      meta={
        items.length > 0 ? (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {items.length}
          </span>
        ) : undefined
      }
      onClose={onClose}
    >
      {items.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Todavía no has guardado nada en esta sesión. Toca cualquier palabra del
          subtítulo y el video se detiene solo para mostrarte qué significa.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {items
            .slice()
            .reverse()
            .map((item) => (
              <button
                key={item.sighting_id}
                onClick={() => {
                  if (item.timestamp_seconds === null) return;
                  onSeek(item.timestamp_seconds);
                }}
                title={
                  item.timestamp_seconds !== null
                    ? `Volver a ${formatClock(item.timestamp_seconds)}`
                    : undefined
                }
                className={cn(
                  "flex items-baseline gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                  "hover:bg-foreground/[0.07]",
                  item.pending && "opacity-60"
                )}
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {item.expression}
                </span>
                {item.translation_es && (
                  <span className="min-w-0 max-w-[45%] truncate text-[11px] text-primary">
                    {item.translation_es}
                  </span>
                )}
                {item.timestamp_seconds !== null && (
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {formatClock(item.timestamp_seconds)}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </Panel>
  );
}

// ── Los subtítulos ──────────────────────────────────────────

/**
 * Qué hacer con los subtítulos, ahora que el texto se lee sobre el video.
 *
 * "¿Dónde dijo eso?" sigue existiendo, así que la transcripción completa queda
 * a un clic — abierta cuando la buscas, ocupando cero cuando no.
 */
export function SubtitlesPanel({
  cueCount,
  follow,
  onFollowChange,
  onBring,
  onDelete,
  onOpenText,
  onClose,
}: {
  cueCount: number;
  follow: boolean;
  onFollowChange: (follow: boolean) => void;
  onBring: () => void;
  onDelete: () => void;
  onOpenText: () => void;
  onClose: () => void;
}) {
  const hasTranscript = cueCount > 0;

  return (
    <Panel
      title="Subtítulos"
      meta={
        hasTranscript ? (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {cueCount} líneas
          </span>
        ) : undefined
      }
      onClose={onClose}
    >
      {hasTranscript ? (
        <>
          <div className="flex flex-col gap-1.5">
            <PanelAction
              onClick={onOpenText}
              icon={<List className="h-3 w-3" />}
              label="Ver el texto"
              title="La transcripción completa, para buscar dónde se dijo algo"
            />
            <PanelAction
              onClick={() => onFollowChange(!follow)}
              icon={<Crosshair className="h-3 w-3" />}
              label={follow ? "Sincronizados" : "Scroll libre"}
              title={
                follow
                  ? "La pista se mueve con el video — tócalo para soltarla"
                  : "La pista no te sigue — tócalo para volver a sincronizar"
              }
              active={follow}
            />
            <PanelAction
              onClick={onBring}
              icon={<RefreshCw className="h-3 w-3" />}
              label="Reemplazar"
              title="Traer la transcripción de nuevo"
            />
            <PanelAction
              onClick={onDelete}
              icon={<Trash2 className="h-3 w-3" />}
              label="Borrar"
              title="Eliminar la transcripción guardada"
              danger
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/40 pt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-0 w-3.5 border-b-2 border-dotted border-[var(--band-4)]" />
              sobre tu nivel
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0 w-3.5 border-b-2 border-primary" />
              ya la tienes
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Todavía no los tienes. Se traen una vez y quedan guardados para
            siempre.
          </p>
          <Button
            onClick={onBring}
            size="sm"
            className="mt-2.5 h-8 w-full rounded-xl"
          >
            Traer subtítulos
          </Button>
        </>
      )}
    </Panel>
  );
}

// ── La sesión ───────────────────────────────────────────────

/**
 * En qué estado está la sesión, cuánto llevas y cómo se cierra.
 *
 * El estado y el reloj efectivo también viven arriba, siempre a la vista: acá
 * están otra vez porque este panel es donde se decide qué hacer con ellos, y
 * decidir sin ver el número es decidir a ciegas.
 */
export function SessionPanel({
  state,
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
  onClose,
}: {
  state: StudioState;
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
  onClose: () => void;
}) {
  const config = STATE_CONFIG[state];

  return (
    <Panel title="La sesión" onClose={onClose}>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold leading-none tabular-nums">
          {formatClock(effectiveSeconds)}
        </p>
        <p className="text-[10px] leading-tight text-muted-foreground">
          efectivo
          <br />
          {formatDuration(elapsedSeconds)} total
        </p>
      </div>

      {config.note && (
        <p className={cn("mt-2 text-[11px] leading-snug", config.text)}>
          {config.note}
        </p>
      )}

      <div className="mt-3.5 flex flex-col gap-1.5">
        {isPaused ? (
          <PanelAction
            onClick={onResume}
            icon={<Play className="h-3.5 w-3.5 fill-current" />}
            label="Reanudar"
            tone="primary"
          />
        ) : (
          <PanelAction
            onClick={onPause}
            icon={<Pause className="h-3.5 w-3.5" />}
            label="Pausar"
            tone="neutral"
          />
        )}

        <PanelAction
          onClick={onFinish}
          icon={<Flag className="h-3.5 w-3.5" />}
          label="Terminar"
          tone="accent"
        />

        <PanelAction
          onClick={onLeave}
          icon={<ArrowLeft className="h-3.5 w-3.5" />}
          label="Volver atrás"
          title="Se guarda el minuto donde quedaste"
        />

        <PanelAction
          onClick={onDiscard}
          icon={<Trash2 className="h-3.5 w-3.5" />}
          label="Descartar"
          title="Borrar esta sesión y su tiempo"
          danger
        />

        {canReset && (
          <PanelAction
            onClick={onReset}
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            label="Reiniciar video"
            title="Dejarlo como si nunca lo hubieras visto"
            danger
          />
        )}
      </div>

      {youtubeUrl && (
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noreferrer"
          title="Abrir en YouTube en el minuto donde vas"
          className={cn(
            "mt-3 flex items-center gap-1.5 border-t border-border/40 pt-3",
            "text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          )}
        >
          <ExternalLink className="h-3 w-3" />
          Abrir en YouTube
        </a>
      )}
    </Panel>
  );
}
