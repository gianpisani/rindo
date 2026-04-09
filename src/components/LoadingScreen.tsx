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

  const logoSize = size === "sm" ? 48 : size === "md" ? 72 : 100;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5",
        fullScreen && "min-h-screen bg-background"
      )}
    >
      <div className="loading-logo-enter">
        <RindoLogo size={logoSize} animate className="text-foreground" />
      </div>
      <span className="text-xs font-bold tracking-tight text-foreground/20 loading-text-enter">
        rindo<span className="text-primary">.</span>
      </span>
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
