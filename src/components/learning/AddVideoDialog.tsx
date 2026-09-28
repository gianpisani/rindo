import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUp, Loader2, X } from "lucide-react";
import { parseYouTubeId, parseYouTubeStart } from "@/lib/learning-config";
import { useVideoMeta } from "@/hooks/useVideoMeta";
import { VideoPreview } from "./VideoPreview";
import "../whisper.css";

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
 * Es el mismo composer para empezar una sesión y para guardar algo para
 * después, porque en los dos casos la pregunta es la misma: cuál video. Va en
 * el formato del Whisper: la línea grande es el link, y debajo el video
 * aparece apenas el link se reconoce (la miniatura al instante, el título un
 * momento después). Acá solo entra YouTube, así que no hay nada que elegir.
 */

const ACCENT = "#fafafa";

const clock = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setUrl("");
  }, [open]);

  const videoId = useMemo(() => parseYouTubeId(url), [url]);
  const meta = useVideoMeta(videoId);
  const invalid = !videoId && url.trim().length > 0;
  const startSeconds = videoId ? parseYouTubeStart(url) : 0;

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!videoId || busy) return;
    onSubmit({
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: meta.title,
      author: meta.author,
      startSeconds,
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="whisper-backdrop" />
        <Dialog.Content
          data-scrollable
          className="whisper-composer"
          style={{ "--whisper-accent": ACCENT } as React.CSSProperties}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">
            {description ? `${description}. ` : ""}Pega el link de YouTube y el video aparece debajo.
          </Dialog.Description>
          <Dialog.Close className="whisper-close" aria-label="Cerrar">
            <X size={16} />
          </Dialog.Close>

          <form onSubmit={submit} className="whisper-form">
            <div className="whisper-type" data-static>
              <span className="whisper-dot" aria-hidden="true" />
              <span>{title}</span>
            </div>

            <div className="whisper-entry">
              <input
                ref={inputRef}
                aria-label="Link de YouTube"
                aria-invalid={invalid}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Pega el link de YouTube"
                className="whisper-input whisper-video-input"
              />
              <div className="whisper-preview" aria-hidden="true">
                {startSeconds > 0 && <span>empieza en {clock(startSeconds)}</span>}
              </div>
            </div>

            <div className="whisper-category-space">
              <div className="whisper-video-preview">
                <VideoPreview
                  videoId={videoId}
                  invalid={invalid}
                  title={meta.title}
                  author={meta.author}
                  loading={meta.loading}
                />
              </div>
              {description && (
                <p className="whisper-caption" aria-live="polite">
                  {description}
                </p>
              )}
            </div>

            <div className="whisper-actions">
              <button type="submit" className="whisper-submit" disabled={!videoId || busy} aria-label={cta}>
                {busy ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <>
                    <span className="whisper-video-cta-icon" aria-hidden="true">{ctaIcon}</span>
                    {cta}
                    <span className="hidden sm:inline" aria-hidden="true">↵</span>
                    <ArrowUp size={14} className="sm:hidden" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
            <p className="whisper-shortcuts">
              <span>
                <kbd>↵</kbd> {cta.toLowerCase()}
              </span>
              <span>
                <kbd>Esc</kbd> cerrar
              </span>
            </p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
