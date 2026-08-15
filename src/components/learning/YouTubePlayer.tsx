import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

// ── Tipos mínimos de la IFrame API ──────────────────────────

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getVideoData(): { title?: string; author?: string; video_id?: string };
  destroy(): void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Carga el script de la IFrame API una sola vez para toda la app. */
let apiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });

  return apiPromise;
}

// ── Componente ──────────────────────────────────────────────

export interface YouTubePlayerHandle {
  play(): void;
  pause(): void;
  toggle(): void;
  seekTo(seconds: number): void;
  seekBy(seconds: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
}

export interface VideoMeta {
  title: string | null;
  author: string | null;
  durationSeconds: number | null;
}

interface YouTubePlayerProps {
  videoId: string;
  startSeconds?: number;
  /** Se dispara cuando el player conoce título, canal y duración. */
  onMeta?: (meta: VideoMeta) => void;
  /** Posición y estado, ~2 veces por segundo. */
  onPlayback?: (positionSeconds: number, playing: boolean) => void;
  onEnded?: () => void;
  className?: string;
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer(
    { videoId, startSeconds = 0, onMeta, onPlayback, onEnded, className },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YTPlayer | null>(null);

    // Los callbacks viven en refs para no recrear el player en cada render.
    const onMetaRef = useRef(onMeta);
    const onPlaybackRef = useRef(onPlayback);
    const onEndedRef = useRef(onEnded);
    useEffect(() => {
      onMetaRef.current = onMeta;
      onPlaybackRef.current = onPlayback;
      onEndedRef.current = onEnded;
    });

    useEffect(() => {
      let cancelled = false;
      let pollId: ReturnType<typeof setInterval> | null = null;

      loadYouTubeApi().then(() => {
        if (cancelled || !containerRef.current || !window.YT) return;

        const player = new window.YT.Player(containerRef.current, {
          videoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            start: Math.floor(startSeconds) || 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              const data = player.getVideoData();
              const duration = player.getDuration();
              onMetaRef.current?.({
                title: data?.title || null,
                author: data?.author || null,
                durationSeconds: duration > 0 ? Math.round(duration) : null,
              });
            },
            onStateChange: (event: { data: number }) => {
              if (cancelled || !window.YT) return;
              const playing = event.data === window.YT.PlayerState.PLAYING;
              onPlaybackRef.current?.(player.getCurrentTime(), playing);

              if (event.data === window.YT.PlayerState.ENDED) {
                onEndedRef.current?.();
              }
              // La duración a veces solo está disponible una vez que arranca.
              if (playing) {
                const duration = player.getDuration();
                const data = player.getVideoData();
                if (duration > 0) {
                  onMetaRef.current?.({
                    title: data?.title || null,
                    author: data?.author || null,
                    durationSeconds: Math.round(duration),
                  });
                }
              }
            },
          },
        });

        playerRef.current = player;

        pollId = setInterval(() => {
          if (!playerRef.current || !window.YT) return;
          try {
            const state = playerRef.current.getPlayerState();
            onPlaybackRef.current?.(
              playerRef.current.getCurrentTime(),
              state === window.YT.PlayerState.PLAYING
            );
          } catch {
            /* el player todavía no responde */
          }
        }, 500);
      });

      return () => {
        cancelled = true;
        if (pollId) clearInterval(pollId);
        try {
          playerRef.current?.destroy();
        } catch {
          /* ya destruido */
        }
        playerRef.current = null;
      };
    }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps

    useImperativeHandle(ref, () => ({
      play: () => playerRef.current?.playVideo(),
      pause: () => playerRef.current?.pauseVideo(),
      toggle: () => {
        const p = playerRef.current;
        if (!p || !window.YT) return;
        if (p.getPlayerState() === window.YT.PlayerState.PLAYING) p.pauseVideo();
        else p.playVideo();
      },
      seekTo: (seconds: number) => playerRef.current?.seekTo(Math.max(0, seconds), true),
      seekBy: (seconds: number) => {
        const p = playerRef.current;
        if (!p) return;
        p.seekTo(Math.max(0, p.getCurrentTime() + seconds), true);
      },
      getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
      getDuration: () => playerRef.current?.getDuration() ?? 0,
      isPlaying: () => {
        const p = playerRef.current;
        if (!p || !window.YT) return false;
        try {
          return p.getPlayerState() === window.YT.PlayerState.PLAYING;
        } catch {
          return false;
        }
      },
    }));

    return (
      <div className={className}>
        {/* La API reemplaza este div por el iframe */}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    );
  }
);
