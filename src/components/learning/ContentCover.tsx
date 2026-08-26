import { useState, type ReactNode } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONTENT_TYPE_CONFIG,
  formatClock,
  youTubeThumbnail,
  type ContentType,
} from "@/lib/learning-config";

/**
 * La portada grande, en 16:9 de verdad.
 *
 * `youTubeThumbnail` devuelve `hqdefault`, que viene en 4:3 con bandas negras:
 * bien para un cuadradito de 64px, pobre para una tarjeta ancha. Esta no existe
 * para todos los videos, así que la portada cae de vuelta en la chica si falla.
 */
function youTubeCover(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}

interface ContentCoverProps {
  externalId: string | null;
  /** Portada guardada, para lo que no es YouTube. */
  thumbnail: string | null;
  contentType: ContentType;
  title: string | null;
  durationSeconds: number | null;
  /**
   * 0–100. Pinta la barra de avance pegada al borde de abajo, como YouTube:
   * cuánto llevas se lee de un vistazo, sin tener que interpretar un número.
   */
  progressPercent?: number | null;
  /** Etiqueta chica encima de la portada, arriba a la izquierda. */
  ribbon?: ReactNode;
  onPlay: () => void;
}

/**
 * La portada de un contenido: es el botón de reproducir.
 *
 * La comparten "seguir viendo" y "para ver después" a propósito. Son dos
 * estanterías del mismo tipo de cosa —videos que te quedan por ver— y verse
 * distinto sería sugerir que una es una lista de tareas y la otra no.
 */
export function ContentCover({
  externalId,
  thumbnail,
  contentType,
  title,
  durationSeconds,
  progressPercent,
  ribbon,
  onPlay,
}: ContentCoverProps) {
  /** La portada grande no existe para todos los videos; se cae a la chica. */
  const [coverFailed, setCoverFailed] = useState(false);
  const src = externalId
    ? coverFailed
      ? youTubeThumbnail(externalId)
      : youTubeCover(externalId)
    : thumbnail;

  return (
    <button
      onClick={onPlay}
      aria-label={`Ver ${title ?? "el video guardado"}`}
      className="relative block w-full aspect-video overflow-hidden bg-muted"
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setCoverFailed(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-3xl">
          {CONTENT_TYPE_CONFIG[contentType]?.emoji ?? "✨"}
        </div>
      )}

      {/* Sombra al pie: sostiene el largo y la barra sobre portadas claras */}
      {(durationSeconds || progressPercent != null) && (
        <span className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
      )}

      {/* Velo y play. En el teléfono no hay hover, así que se ve siempre. */}
      <span className="absolute inset-0 bg-foreground/25 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200" />
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          "transition-all duration-200",
          "sm:opacity-0 sm:scale-90 sm:group-hover:opacity-100 sm:group-hover:scale-100"
        )}
      >
        <span className="flex size-10 sm:size-12 items-center justify-center rounded-full bg-background/90 shadow-lg backdrop-blur-sm">
          <Play className="h-4 w-4 sm:h-5 sm:w-5 translate-x-[1px] fill-current text-foreground" />
        </span>
      </span>

      {ribbon && <span className="absolute left-1.5 top-1.5">{ribbon}</span>}

      {/* Largo del video, apoyado justo encima de la barra */}
      {durationSeconds ? (
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
          {formatClock(durationSeconds)}
        </span>
      ) : null}

      {/* Cuánto llevas: al ras del borde, sin margen ni esquinas */}
      {progressPercent != null && (
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/30">
          <span
            className="block h-full bg-primary"
            style={{ width: `${Math.min(Math.max(progressPercent, 2), 100)}%` }}
          />
        </span>
      )}
    </button>
  );
}
