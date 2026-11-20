import { Contrast } from "lucide-react";
import type { ThemeDraft } from "@/hooks/useThemeDraft";
import { ColorModeToggle } from "./ColorModeToggle";
import { FontPicker } from "./FontPicker";
import { PalettePicker } from "./PalettePicker";
import { RadiusPicker } from "./RadiusPicker";
import { SectionLabel } from "./SectionLabel";

export function ThemeEditor({ draft }: { draft: ThemeDraft }) {
  return (
    <div className="space-y-6">
      <div>
        <SectionLabel icon={Contrast}>Modo</SectionLabel>
        <ColorModeToggle colorMode={draft.colorMode} onChange={draft.changeMode} />
      </div>

      <PalettePicker
        currentMode={draft.currentMode}
        selectedTheme={draft.choice.themeId}
        customHue={draft.choice.hue}
        customPalette={draft.customPalette}
        onSelectTheme={draft.selectTheme}
        onHueChange={draft.changeHue}
      />

      <FontPicker selectedFont={draft.choice.font} onChange={draft.changeFont} />

      <RadiusPicker radius={draft.choice.radius} onChange={draft.changeRadius} />
    </div>
  );
}
