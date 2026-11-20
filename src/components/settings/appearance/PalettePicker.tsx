import { Palette } from "lucide-react";
import { THEME_PRESETS, type PaletteVars } from "@/lib/theme";
import { RINDO_PREVIEW } from "@/lib/theme-choice";
import { HueSlider } from "./HueSlider";
import { SectionLabel } from "./SectionLabel";
import { ThemePreviewCard } from "./ThemePreviewCard";

export function PalettePicker({
  currentMode,
  selectedTheme,
  customHue,
  customPalette,
  onSelectTheme,
  onHueChange,
}: {
  currentMode: "light" | "dark";
  selectedTheme: string | null;
  customHue: number;
  customPalette: PaletteVars;
  onSelectTheme: (themeId: string | null) => void;
  onHueChange: (hue: number) => void;
}) {
  return (
    <div>
      <SectionLabel icon={Palette}>Color</SectionLabel>
      <div className="grid grid-cols-4 gap-2 p-0.5">
        <ThemePreviewCard
          palette={RINDO_PREVIEW[currentMode]}
          name="Rindo"
          selected={selectedTheme === null}
          onClick={() => onSelectTheme(null)}
        />
        {THEME_PRESETS.map((preset) => {
          const palette = currentMode === "dark" ? preset.dark : preset.light;
          return (
            <ThemePreviewCard
              key={preset.id}
              palette={palette}
              name={preset.name}
              selected={selectedTheme === preset.id}
              onClick={() => onSelectTheme(preset.id)}
            />
          );
        })}
        <ThemePreviewCard
          palette={customPalette}
          name="Custom"
          selected={selectedTheme === "custom"}
          onClick={() => onSelectTheme("custom")}
        />
      </div>

      {selectedTheme === "custom" && (
        <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <HueSlider value={customHue} onChange={onHueChange} mode={currentMode} />
        </div>
      )}
    </div>
  );
}
