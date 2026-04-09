import { cn } from "@/lib/utils";
import { RindoLogo } from "./RindoLogo";

interface LoadingScreenProps {
  fullScreen?: boolean;
  message?: string;
  size?: "sm" | "md" | "lg";
  showFunFact?: boolean;
}

export function LoadingScreen({
  fullScreen = true,
  message,
  size = "md",
}: LoadingScreenProps) {
  if (message) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-3",
          fullScreen && "min-h-screen bg-background"
        )}
      >
        <RindoLogo size={20} className="text-foreground/40 loading-breathe" />
        <p className="text-sm text-muted-foreground font-mono">{message}</p>
      </div>
    );
  }

  const logoSize = size === "sm" ? 48 : size === "md" ? 80 : 120;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        fullScreen && "min-h-screen bg-background"
      )}
    >
      {/* Outer glow ring */}
      <div className="relative">
        {/* Pulsing glow */}
        <div className="absolute inset-0 loading-glow-pulse">
          <div
            className="w-full h-full rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)",
              transform: "scale(2.5)",
            }}
          />
        </div>

        {/* Spinning ring */}
        <div className="absolute inset-0 flex items-center justify-center loading-spin-slow">
          <svg
            width={logoSize * 1.8}
            height={logoSize * 1.8}
            viewBox="0 0 100 100"
            fill="none"
            className="absolute"
            style={{ marginLeft: -(logoSize * 0.4), marginTop: -(logoSize * 0.4) }}
          >
            <circle
              cx="50" cy="50" r="46"
              stroke="hsl(var(--primary))"
              strokeWidth="0.5"
              strokeDasharray="12 8"
              opacity="0.2"
            />
          </svg>
        </div>

        {/* Orbiting dot */}
        <div className="absolute inset-0 flex items-center justify-center loading-orbit">
          <div
            className="absolute w-1.5 h-1.5 rounded-full bg-primary loading-dot-glow"
            style={{ transform: `translateY(-${logoSize * 0.85}px)` }}
          />
        </div>

        {/* Logo */}
        <div className="loading-logo-enter">
          <RindoLogo size={logoSize} animate className="text-foreground" />
        </div>
      </div>

      {/* Brand text */}
      <div className="mt-6 loading-text-enter">
        <span className="text-sm font-bold tracking-tight text-foreground/20">
          rindo<span className="text-primary/40">.</span>
        </span>
      </div>

      {/* Subtle loading bar */}
      <div className="mt-6 w-16 h-[2px] rounded-full bg-muted/20 overflow-hidden loading-text-enter">
        <div className="h-full w-1/3 rounded-full bg-primary/40 loading-bar-slide" />
      </div>
    </div>
  );
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <RindoLogo size={24} className="text-foreground/60 loading-breathe" />
    </div>
  );
}
