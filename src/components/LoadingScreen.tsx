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
      <div className="relative flex flex-col items-center">
        {/* Logo area */}
        <div className="relative" style={{ width: logoSize, height: logoSize }}>
          {/* Pulsing glow */}
          <div className="absolute inset-0 flex items-center justify-center loading-glow-pulse">
            <div
              className="rounded-full"
              style={{
                width: logoSize * 2.5,
                height: logoSize * 2.5,
                background: "radial-gradient(circle, hsl(var(--primary) / 0.12) 0%, transparent 70%)",
              }}
            />
          </div>

          {/* Spinning dashed ring */}
          <div className="absolute inset-0 flex items-center justify-center loading-spin-slow">
            <svg
              width={logoSize * 1.7}
              height={logoSize * 1.7}
              viewBox="0 0 100 100"
              fill="none"
            >
              <circle
                cx="50" cy="50" r="46"
                stroke="hsl(var(--primary))"
                strokeWidth="0.5"
                strokeDasharray="10 6"
                opacity="0.15"
              />
            </svg>
          </div>

          {/* Logo */}
          <div className="loading-logo-enter relative z-10">
            <RindoLogo size={logoSize} animate className="text-foreground" />
          </div>

          {/* The orbiting dot — orbits once then lands on the period of "rindo." */}
          <div
            className="absolute rounded-full bg-primary loading-orbit-land z-20"
            style={{
              width: 7,
              height: 7,
              top: "50%",
              left: "50%",
              marginLeft: -3.5,
              marginTop: -3.5,
              boxShadow: "0 0 8px hsl(var(--primary) / 0.5)",
            }}
          />
        </div>

        {/* Brand text — period is invisible, the dot becomes it */}
        <div className="mt-6 loading-text-enter">
          <span className="text-sm font-bold tracking-tight text-foreground/20">
            rindo<span className="text-transparent">.</span>
          </span>
        </div>

        {/* Subtle loading bar */}
        <div className="mt-5 w-16 h-[2px] rounded-full bg-muted/20 overflow-hidden loading-text-enter">
          <div className="h-full w-1/3 rounded-full bg-primary/40 loading-bar-slide" />
        </div>
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
