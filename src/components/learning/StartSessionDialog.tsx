import { Play } from "lucide-react";
import { youTubeThumbnail } from "@/lib/learning-config";
import type { StartSessionInput } from "@/hooks/useActiveLearningSession";
import { AddVideoDialog } from "./AddVideoDialog";

interface StartSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalId: string;
  onStart: (input: StartSessionInput, startSeconds: number) => void;
  isStarting?: boolean;
}

/**
 * Empezar una sesión es elegir un video.
 *
 * Había cinco tipos de contenido para elegir —podcast, artículo, serie, otro—
 * con un formulario distinto detrás de cada uno, y cuatro de esos caminos
 * terminaban en un cronómetro sin reproductor, sin subtítulos y sin nada que
 * tocar. Todo lo que esta pantalla sabe hacer necesita el video adentro.
 */
export function StartSessionDialog({
  open,
  onOpenChange,
  goalId,
  onStart,
  isStarting,
}: StartSessionDialogProps) {
  return (
    <AddVideoDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva sesión"
      description="¿Qué vas a ver?"
      cta="Empezar sesión"
      ctaIcon={<Play className="mr-2 h-4 w-4 fill-current" />}
      busy={isStarting}
      onSubmit={(video) =>
        onStart(
          {
            goal_id: goalId,
            content_type: "youtube",
            content_url: video.url,
            external_id: video.videoId,
            content_thumbnail: youTubeThumbnail(video.videoId),
            // El reproductor los confirma al montar, pero para entonces la
            // pantalla ya se dibujó: con lo que trajo la vista previa, la
            // sesión arranca con su nombre puesto y no con un "Cargando…".
            ...(video.title ? { content_title: video.title } : {}),
            ...(video.author ? { content_author: video.author } : {}),
          },
          video.startSeconds
        )
      }
    />
  );
}
