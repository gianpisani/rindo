import { useEffect, useMemo, useState } from "react";
import { BaseModal } from "@/components/BaseModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Play, Link2, Loader2 } from "lucide-react";
import {
  CONTENT_TYPE_CONFIG,
  parseYouTubeId,
  parseYouTubeStart,
  youTubeThumbnail,
  type ContentType,
} from "@/lib/learning-config";
import type { StartSessionInput } from "@/hooks/useActiveLearningSession";
import { useVideoMeta } from "@/hooks/useVideoMeta";
import { VideoPreview } from "./VideoPreview";

interface StartSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalId: string;
  onStart: (input: StartSessionInput, startSeconds: number) => void;
  isStarting?: boolean;
}

const TYPES: ContentType[] = ["youtube", "podcast", "article", "series", "other"];

export function StartSessionDialog({
  open,
  onOpenChange,
  goalId,
  onStart,
  isStarting,
}: StartSessionDialogProps) {
  const [type, setType] = useState<ContentType>("youtube");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("");

  useEffect(() => {
    if (!open) return;
    setType("youtube");
    setUrl("");
    setTitle("");
    setMinutes("");
  }, [open]);

  const videoId = useMemo(
    () => (type === "youtube" ? parseYouTubeId(url) : null),
    [type, url]
  );

  const isYouTube = type === "youtube";
  const canStart = isYouTube ? !!videoId : title.trim().length > 0;

  const meta = useVideoMeta(videoId);

  const handleStart = () => {
    if (!canStart) return;

    if (isYouTube && videoId) {
      onStart(
        {
          goal_id: goalId,
          content_type: "youtube",
          content_url: `https://www.youtube.com/watch?v=${videoId}`,
          external_id: videoId,
          content_thumbnail: youTubeThumbnail(videoId),
          // El reproductor los confirma al montar, pero para entonces la
          // pantalla ya se dibujó: con lo que trajo la vista previa, la sesión
          // arranca con su nombre puesto en vez de con un "Cargando…".
          ...(meta.title ? { content_title: meta.title } : {}),
          ...(meta.author ? { content_author: meta.author } : {}),
        },
        parseYouTubeStart(url)
      );
    } else {
      const parsedMinutes = Number(minutes);
      onStart(
        {
          goal_id: goalId,
          content_type: type,
          content_url: url.trim() || null,
          content_title: title.trim(),
          content_duration_seconds:
            Number.isFinite(parsedMinutes) && parsedMinutes > 0
              ? Math.round(parsedMinutes * 60)
              : null,
        },
        0
      );
    }
  };

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva sesión"
      description="¿Qué vas a consumir?"
      maxWidth="lg"
      footer={
        <Button
          onClick={handleStart}
          disabled={!canStart || isStarting}
          className="w-full h-12 text-base font-semibold rounded-xl"
        >
          {isStarting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Play className="h-5 w-5 mr-2 fill-current" />
              Empezar sesión
            </>
          )}
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Tipo de contenido */}
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => {
            const config = CONTENT_TYPE_CONFIG[t];
            const isSelected = type === t;
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "px-3 py-2 rounded-xl text-sm font-medium border transition-all",
                  "flex items-center gap-1.5",
                  isSelected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                <span>{config.emoji}</span>
                {config.label}
              </button>
            );
          })}
        </div>

        {/* YouTube: solo el link */}
        {isYouTube ? (
          <div className="space-y-3">
            <div>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="learning-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canStart) handleStart();
                  }}
                  placeholder="https://youtube.com/watch?v=..."
                  autoFocus
                  className="pl-9 h-11 rounded-xl"
                />
              </div>
            </div>

            <VideoPreview
              videoId={videoId}
              invalid={!videoId && url.trim().length > 0}
              title={meta.title}
              author={meta.author}
              loading={meta.loading}
            />
          </div>
        ) : (
          /* Resto: título y duración a mano */
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="learning-title" className="text-xs text-muted-foreground">
                ¿Qué es?
              </Label>
              <Input
                id="learning-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lenny's Podcast — episodio con Brian Chesky"
                autoFocus
                className="h-11 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="learning-minutes" className="text-xs text-muted-foreground">
                  Duración (min)
                </Label>
                <Input
                  id="learning-minutes"
                  type="number"
                  inputMode="numeric"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="45"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="learning-link" className="text-xs text-muted-foreground">
                  Link (opcional)
                </Label>
                <Input
                  id="learning-link"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Sin reproductor embebido solo se mide el tiempo de estudio: pon
              play afuera y usa el cronómetro de Rindo.
            </p>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
