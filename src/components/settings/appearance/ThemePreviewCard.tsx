import type { PaletteVars } from "@/lib/theme";
import { revealOriginOf, type RevealOrigin } from "@/lib/theme-transition";
import { cn } from "@/lib/utils";

export function ThemePreviewCard({
  palette,
  name,
  selected,
  onSelect,
}: {
  palette: PaletteVars;
  name: string;
  selected: boolean;
  onSelect: (origin: RevealOrigin) => void;
}) {
  const line = (color: string, width: string) => (
    <div className="h-1 rounded-full transition-colors duration-500" style={{ backgroundColor: color, width }} />
  );
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={(e) => onSelect(revealOriginOf(e.currentTarget))}
      className="group flex flex-col items-center gap-2 rounded-card p-1 text-left"
    >
      <div
        className={cn(
          "flex w-full aspect-[16/10] overflow-hidden rounded-card border outline outline-2 outline-offset-2 transition-[outline-color,transform,background-color] duration-300 ease-out",
          selected ? "outline-foreground" : "outline-transparent group-hover:scale-[1.02] group-active:scale-[0.98]"
        )}
        style={{ backgroundColor: palette.background, borderColor: palette.border }}
      >
        <div
          className="flex h-full w-1/4 flex-col gap-1 border-r px-1.5 pt-2 transition-colors duration-500"
          style={{ backgroundColor: palette.sidebar, borderColor: palette.border }}
        >
          <div className="size-1.5 rounded-full transition-colors duration-500" style={{ backgroundColor: palette.primary }} />
          {line(palette.mutedForeground, "80%")}
          {line(palette.mutedForeground, "60%")}
        </div>
        <div className="flex-1 space-y-1.5 p-2">
          {line(palette.foreground, "45%")}
          <div
            className="space-y-1 rounded-card border p-1.5 transition-colors duration-500"
            style={{ backgroundColor: palette.card, borderColor: palette.border }}
          >
            {line(palette.foreground, "70%")}
            {line(palette.primary, "40%")}
          </div>
          <div
            className="rounded-card border p-1.5 transition-colors duration-500"
            style={{ backgroundColor: palette.card, borderColor: palette.border }}
          >
            {line(palette.mutedForeground, "55%")}
          </div>
        </div>
      </div>
      <span className={cn("text-xs transition-colors", selected ? "text-foreground" : "text-muted-foreground")}>{name}</span>
    </button>
  );
}
