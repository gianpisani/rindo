import type { ThemeDraft } from "@/hooks/useThemeDraft";
import { ColorModeToggle } from "./ColorModeToggle";
import { FontPicker } from "./FontPicker";
import { PalettePicker } from "./PalettePicker";
import { RadiusPicker } from "./RadiusPicker";

export function ThemeStep({ draft }: { draft: ThemeDraft }) {
  return (
    <div className="space-y-6 max-h-[55vh] overflow-y-auto overscroll-contain pr-1 -mr-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
      <ColorModeToggle colorMode={draft.colorMode} onChange={draft.changeMode} />

      <PalettePicker
        currentMode={draft.currentMode}
        selectedTheme={draft.selectedTheme}
        customHue={draft.customHue}
        customPalette={draft.customPalette}
        onSelectTheme={draft.selectTheme}
        onHueChange={draft.changeHue}
      />

      <FontPicker selectedFont={draft.selectedFont} onChange={draft.changeFont} />

      <RadiusPicker radius={draft.customRadius} onChange={draft.changeRadius} />
    </div>
  );
}
