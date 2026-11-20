import { cn } from "@/lib/utils";
import type { PreviewPalette } from "@/lib/theme-choice";

export function ThemePreviewCard({
  palette,
  name,
  selected,
  onClick,
}: {
  palette: PreviewPalette;
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  const line = (color: string, width: string) => (
    <div className="h-1 rounded-full" style={{ backgroundColor: color, width }} />
  );
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 p-1.5 rounded-card transition-all duration-200",
        selected ? "ring-2 ring-foreground" : "active:scale-[0.97]"
      )}
    >
      <div
        className="flex w-full aspect-[4/3] rounded-card overflow-hidden border"
        style={{ backgroundColor: palette.background, borderColor: palette.border }}
      >
        <div
          className="w-1/4 h-full flex flex-col items-center gap-1 pt-2 border-r"
          style={{ backgroundColor: palette.sidebar, borderColor: palette.border }}
        >
          <div className="size-1.5 rounded-full" style={{ backgroundColor: palette.primary }} />
          {line(palette.mutedForeground, "50%")}
          {line(palette.mutedForeground, "50%")}
        </div>
        <div className="flex-1 p-1.5 space-y-1">
          {line(palette.foreground, "60%")}
          <div
            className="rounded-card border p-1 space-y-1"
            style={{ backgroundColor: palette.card, borderColor: palette.border }}
          >
            {line(palette.foreground, "70%")}
            {line(palette.mutedForeground, "45%")}
          </div>
          <div
            className="rounded-card border p-1"
            style={{ backgroundColor: palette.card, borderColor: palette.border }}
          >
            {line(palette.mutedForeground, "55%")}
          </div>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{name}</span>
    </button>
  );
}
