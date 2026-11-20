import { cn } from "@/lib/utils";
import type { ColorMode } from "@/hooks/useThemeDraft";
import { revealOriginOf, type RevealOrigin } from "@/lib/theme-transition";
import { COLOR_MODES } from "./color-modes";


export function ColorModeToggle({
  colorMode,
  onChange,
}: {
  colorMode: string;
  onChange: (mode: ColorMode, origin: RevealOrigin) => void;
}) {
  const activeIndex = COLOR_MODES.findIndex(({ value }) => value === colorMode);

  return (
    <div role="radiogroup" aria-label="Modo de color" className="relative grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
      {activeIndex >= 0 && (
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 rounded-full bg-card transition-transform duration-300 ease-out"
          style={{ width: "calc((100% - 16px) / 3)", transform: `translateX(calc(${activeIndex} * (100% + 4px)))` }}
        />
      )}
      {COLOR_MODES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={colorMode === value}
          onClick={(e) => onChange(value, revealOriginOf(e.currentTarget))}
          className={cn(
            "relative flex h-9 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors duration-300",
            colorMode === value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
