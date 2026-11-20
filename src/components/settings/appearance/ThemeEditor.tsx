import type { ReactNode } from "react";
import { Contrast } from "lucide-react";
import type { ThemeDraft } from "@/hooks/useThemeDraft";
import { AccentPicker } from "./AccentPicker";
import { ColorModeToggle } from "./ColorModeToggle";
import { FontPicker } from "./FontPicker";
import { RadiusPicker } from "./RadiusPicker";
import { SectionLabel } from "./SectionLabel";
import { SurfacePicker } from "./SurfacePicker";

const STAGGER_MS = 50;

export function ThemeEditor({ draft }: { draft: ThemeDraft }) {
  const sections: ReactNode[] = [
    <div key="mode">
      <SectionLabel icon={Contrast}>Modo</SectionLabel>
      <ColorModeToggle colorMode={draft.colorMode} onChange={draft.changeMode} />
    </div>,
    <SurfacePicker key="surface" choice={draft.choice} mode={draft.currentMode} onSelect={draft.selectSurface} />,
    <AccentPicker
      key="accent"
      choice={draft.choice}
      mode={draft.currentMode}
      onSelect={draft.selectAccent}
      onHueChange={draft.changeHue}
    />,
    <FontPicker key="font" selectedFont={draft.choice.font} onChange={draft.changeFont} />,
    <RadiusPicker key="radius" radius={draft.choice.radius} onChange={draft.changeRadius} />,
  ];

  return (
    <div className="space-y-6">
      {sections.map((section, index) => (
        <div
          key={index}
          className="animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500 ease-out"
          style={{ animationDelay: `${index * STAGGER_MS}ms` }}
        >
          {section}
        </div>
      ))}
    </div>
  );
}
