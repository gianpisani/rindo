import { findPreset, parseCustomSettings, type CustomThemeSettings, type PaletteVars } from "./theme";

export const DEFAULT_RADIUS = 0.75;
const DEFAULT_HUE = 240;
const DEFAULT_FONT = "default";

export type PreviewPalette = Pick<
  PaletteVars,
  "background" | "card" | "sidebar" | "primary" | "foreground" | "mutedForeground" | "border"
>;

export const RINDO_PREVIEW: Record<"light" | "dark", PreviewPalette> = {
  light: {
    background: "oklch(0.965 0.002 286)",
    card: "oklch(0.995 0 0)",
    sidebar: "oklch(0.955 0.002 286)",
    primary: "oklch(0.586 0.253 17.585)",
    foreground: "oklch(0.13 0.005 285.823)",
    mutedForeground: "oklch(0.355 0.016 285.938)",
    border: "oklch(0.835 0.008 286)",
  },
  dark: {
    background: "oklch(0.098 0.005 285.823)",
    card: "oklch(0.141 0.005 285.823)",
    sidebar: "oklch(0.12 0.005 285.823)",
    primary: "oklch(0.645 0.246 16.439)",
    foreground: "oklch(0.985 0 0)",
    mutedForeground: "oklch(0.705 0.015 286.067)",
    border: "oklch(1 0 0 / 8%)",
  },
};

export interface ThemeChoice {
  themeId: string | null;
  hue: number;
  font: string;
  radius: number;
}

export const INITIAL_THEME_CHOICE: ThemeChoice = {
  themeId: null,
  hue: DEFAULT_HUE,
  font: DEFAULT_FONT,
  radius: DEFAULT_RADIUS,
};

export function themeChoiceFromProfile(
  savedThemeId: string | null,
  settingsJson: string | null
): ThemeChoice {
  const settings = parseCustomSettings(settingsJson);
  return {
    themeId: savedThemeId === "custom" ? savedThemeId : findPreset(savedThemeId)?.id ?? null,
    hue: settings.hue ?? DEFAULT_HUE,
    font: settings.font ?? DEFAULT_FONT,
    radius: settings.radius ?? DEFAULT_RADIUS,
  };
}

export function serializeThemeChoice({ themeId, hue, font, radius }: ThemeChoice): string | null {
  const settings: CustomThemeSettings = {};
  if (themeId === "custom") settings.hue = hue;
  if (font !== DEFAULT_FONT) settings.font = font;
  if (Math.abs(radius - DEFAULT_RADIUS) > 0.01) settings.radius = radius;
  return Object.keys(settings).length > 0 ? JSON.stringify(settings) : null;
}

export function profileInitials(nickname: string, fullName: string) {
  return (nickname || fullName || "?").slice(0, 2).toUpperCase();
}
