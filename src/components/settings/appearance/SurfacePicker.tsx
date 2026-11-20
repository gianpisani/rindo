import { PaintBucket } from "lucide-react";
import { resolvePalette, type Surface, type ThemeMode } from "@/lib/theme";
import { themeChoiceSettings, type ThemeChoice } from "@/lib/theme-choice";
import type { RevealOrigin } from "@/lib/theme-transition";
import { SectionLabel } from "./SectionLabel";
import { ThemePreviewCard } from "./ThemePreviewCard";

const SURFACES: Surface[] = ["neutral", "tinted"];

const surfaceName = (surface: Surface, mode: ThemeMode) =>
  surface === "tinted" ? "Teñido" : mode === "dark" ? "Negro" : "Blanco";

export function SurfacePicker({
  choice,
  mode,
  onSelect,
}: {
  choice: ThemeChoice;
  mode: ThemeMode;
  onSelect: (surface: Surface, origin: RevealOrigin) => void;
}) {
  return (
    <div>
      <SectionLabel icon={PaintBucket}>Fondo</SectionLabel>
      <div role="radiogroup" aria-label="Fondo" className="grid grid-cols-2 gap-2">
        {SURFACES.map((surface) => (
          <ThemePreviewCard
            key={surface}
            name={surfaceName(surface, mode)}
            palette={resolvePalette(choice.themeId, { ...themeChoiceSettings(choice), surface }, mode)}
            selected={choice.surface === surface}
            onSelect={(origin) => onSelect(surface, origin)}
          />
        ))}
      </div>
    </div>
  );
}
