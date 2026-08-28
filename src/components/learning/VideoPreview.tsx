import { Link2, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { youTubeThumbnail } from "@/lib/learning-config";

interface VideoPreviewProps {
  /** El id ya reconocido en el link, o null si todavía no hay ninguno. */
  videoId: string | null;
  /** Hay algo escrito y no es un link de YouTube. */
  invalid?: boolean;
  title: string | null;
  author: string | null;
  loading?: boolean;
  className?: string;
}

/**
 * El video que estás por guardar, antes de guardarlo.
 *
 * Pegar un link era escribir a ciegas: una caja de texto, un botón, y la
 * confianza de que ese amasijo de caracteres era el video que querías. Acá el
 * link deja de ser texto y se vuelve el video.
 *
 * El hueco existe desde antes de pegar nada y tiene la forma exacta que va a
 * tener el video, así que al pegar no salta nada: la miniatura entra en su
 * lugar —su dirección se arma con el id, sin preguntarle a nadie, o sea al
 * instante— y el título aterriza un momento después, cuando contesta YouTube.
 */
export function VideoPreview({
  videoId,
  invalid,
  title,
  author,
  loading,
  className,
}: VideoPreviewProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-2 transition-colors duration-300",
        // Con el video puesto el marco sobra: la miniatura ya es una forma.
        videoId
          ? "border-transparent"
          : "border-dashed border-border/50 bg-muted/10",
        invalid && "border-destructive/40",
        className
      )}
    >
      <div
        className={cn(
          "relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg sm:w-36",
          videoId ? "bg-black" : "bg-muted/40"
        )}
      >
        {videoId ? (
          <>
            <img
              src={youTubeThumbnail(videoId)}
              alt=""
              loading="eager"
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <Play className="h-5 w-5 fill-white text-white drop-shadow" />
            </span>
          </>
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <Link2 className="h-4 w-4 text-muted-foreground/40" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!videoId ? (
          <p className="text-[13px] text-muted-foreground">
            {invalid
              ? "No reconozco ese link de YouTube."
              : "Pega el link y el video aparece acá."}
          </p>
        ) : loading || !title ? (
          // El esqueleto tiene el alto de dos líneas de título: cuando llega el
          // texto ocupa lo mismo y la tarjeta no se mueve.
          <div className="space-y-1.5 py-0.5">
            <span className="block h-3.5 w-3/4 animate-pulse rounded bg-muted" />
            <span className="block h-3 w-1/3 animate-pulse rounded bg-muted/60" />
          </div>
        ) : (
          <>
            <p className="line-clamp-2 text-sm font-semibold leading-snug">
              {title}
            </p>
            {author && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {author}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
