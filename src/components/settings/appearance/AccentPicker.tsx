import { Check, Palette } from "lucide-react";
import { ACCENT_PRESETS, generatedAccent, resolvePalette, type ThemeMode } from "@/lib/theme";
import type { ThemeChoice } from "@/lib/theme-choice";
import { revealOriginOf, type RevealOrigin } from "@/lib/theme-transition";
import { cn } from "@/lib/utils";
import { HueSlider } from "./HueSlider";
import { SectionLabel } from "./SectionLabel";

const ACCENTS: { id: string | null; name: string }[] = [
  { id: null, name: "Rindo" },
  ...ACCENT_PRESETS,
  { id: "custom", name: "Propio" },
];

const hueWheel = (mode: ThemeMode) =>
  `conic-gradient(${Array.from({ length: 13 }, (_, i) => generatedAccent(i * 30, mode).primary).join(", ")})`;

export function AccentPicker({
  choice,
  mode,
  onSelect,
  onHueChange,
}: {
  choice: ThemeChoice;
  mode: ThemeMode;
  onSelect: (themeId: string | null, origin: RevealOrigin) => void;
  onHueChange: (hue: number) => void;
}) {
  const selectedName = ACCENTS.find((a) => a.id === choice.themeId)?.name ?? "Rindo";

  return (
    <div>
      <SectionLabel icon={Palette}>
        Acento <span className="text-foreground">· {selectedName}</span>
      </SectionLabel>
      <div role="radiogroup" aria-label="Acento" className="flex items-center justify-between gap-1 py-1">
        {ACCENTS.map(({ id, name }) => {
          const selected = choice.themeId === id;
          const accent = resolvePalette(id, { hue: choice.hue }, mode);
          const isWheel = id === "custom" && !selected;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={name}
              title={name}
              onClick={(e) => onSelect(id, revealOriginOf(e.currentTarget))}
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full outline outline-2 outline-offset-2 transition-[outline-color,transform] duration-200 ease-out active:scale-90",
                selected ? "outline-foreground" : "outline-transparent hover:scale-110"
              )}
              style={{ background: isWheel ? hueWheel(mode) : accent.primary }}
            >
              <Check
                className={cn(
                  "size-4 transition-[opacity,transform] duration-200 ease-out",
                  selected ? "scale-100 opacity-100" : "scale-50 opacity-0"
                )}
                style={{ color: accent.primaryForeground }}
              />
            </button>
          );
        })}
      </div>

      {choice.themeId === "custom" && (
        <div className="mt-3 animate-in fade-in-0 slide-in-from-top-1 duration-300">
          <HueSlider value={choice.hue} onChange={onHueChange} mode={mode} />
        </div>
      )}
    </div>
  );
}
