import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BaseModal } from "@/components/BaseModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Loader2 } from "lucide-react";
import { parseYouTubeId, parseYouTubeStart } from "@/lib/learning-config";
import { useVideoMeta } from "@/hooks/useVideoMeta";
import { VideoPreview } from "./VideoPreview";

export interface ChosenVideo {
  videoId: string;
  url: string;
  title: string | null;
  author: string | null;
  /** El minuto que venía en el link, si venía alguno. */
  startSeconds: number;
}

interface AddVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  cta: string;
  ctaIcon?: ReactNode;
  busy?: boolean;
  onSubmit: (video: ChosenVideo) => void;
}

/**
 * Un link, el video, y listo.
 *
 * Es el mismo diálogo para empezar una sesión y para guardar algo para después,
 * porque en los dos casos la pregunta es la misma: cuál video. Antes eran dos
 * cosas distintas —un modal con cinco tipos de contenido y un formulario
 * incrustado en la lista— y ninguna se parecía a la otra.
 *
 * Acá solo entra YouTube, así que no hay nada que elegir: un campo, y el video
 * apareciendo debajo apenas el link se reconoce.
 */
export function AddVideoDialog({
  open,
  onOpenChange,
  title,
  description,
  cta,
  ctaIcon,
  busy,
  onSubmit,
}: AddVideoDialogProps) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (open) setUrl("");
  }, [open]);

  const videoId = useMemo(() => parseYouTubeId(url), [url]);
  const meta = useVideoMeta(videoId);

  const submit = () => {
    if (!videoId || busy) return;
    onSubmit({
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: meta.title,
      author: meta.author,
      startSeconds: parseYouTubeStart(url),
    });
  };

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      maxWidth="md"
      footer={
        <Button
          onClick={submit}
          disabled={!videoId || busy}
          className="h-11 w-full rounded-xl text-sm font-semibold"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {ctaIcon}
              {cta}
            </>
          )}
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Pega el link de YouTube"
            autoFocus
            className="h-11 rounded-xl pl-9"
          />
        </div>

        <VideoPreview
          videoId={videoId}
          invalid={!videoId && url.trim().length > 0}
          title={meta.title}
          author={meta.author}
          loading={meta.loading}
        />
      </div>
    </BaseModal>
  );
}
