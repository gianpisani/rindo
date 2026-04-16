import { useEffect } from "react";
import { useUserProfile } from "./useUserProfile";

export const PRESET_GRADIENTS = [
  { name: "Rindo", color1: null, color2: null },
  { name: "Océano", color1: "oklch(0.55 0.2 240)", color2: "oklch(0.65 0.18 200)" },
  { name: "Bosque", color1: "oklch(0.55 0.18 155)", color2: "oklch(0.65 0.15 130)" },
  { name: "Lavanda", color1: "oklch(0.55 0.2 290)", color2: "oklch(0.65 0.18 320)" },
  { name: "Atardecer", color1: "oklch(0.6 0.25 30)", color2: "oklch(0.65 0.22 60)" },
  { name: "Neón", color1: "oklch(0.7 0.25 150)", color2: "oklch(0.65 0.25 280)" },
  { name: "Cereza", color1: "oklch(0.55 0.25 0)", color2: "oklch(0.6 0.22 340)" },
  { name: "Oro", color1: "oklch(0.7 0.18 85)", color2: "oklch(0.65 0.2 55)" },
] as const;

export type PresetGradient = (typeof PRESET_GRADIENTS)[number];

export function useCustomTheme() {
  const { profile } = useUserProfile();

  useEffect(() => {
    const root = document.documentElement;

    if (!profile?.accent_color_1) {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--accent-gradient");
      root.style.removeProperty("--ring");
      return;
    }

    const c1 = profile.accent_color_1;
    const c2 = profile.accent_color_2 || c1;

    root.style.setProperty("--primary", c1);
    root.style.setProperty("--sidebar-primary", c1);
    root.style.setProperty("--ring", c1);
    root.style.setProperty(
      "--accent-gradient",
      `linear-gradient(135deg, ${c1}, ${c2})`
    );
  }, [profile?.accent_color_1, profile?.accent_color_2]);
}
