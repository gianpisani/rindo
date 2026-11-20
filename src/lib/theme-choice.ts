import { defaultSurface, findPreset, parseCustomSettings, type CustomThemeSettings, type Surface } from "./theme.ts";

export const DEFAULT_RADIUS = 0.75;
const DEFAULT_HUE = 240;
const DEFAULT_FONT = "default";

export interface ThemeChoice {
  themeId: string | null;
  surface: Surface;
  hue: number;
  font: string;
  radius: number;
}

export const INITIAL_THEME_CHOICE: ThemeChoice = {
  themeId: null,
  surface: "neutral",
  hue: DEFAULT_HUE,
  font: DEFAULT_FONT,
  radius: DEFAULT_RADIUS,
};

export function themeChoiceFromProfile(
  savedThemeId: string | null,
  settingsJson: string | null
): ThemeChoice {
  const settings = parseCustomSettings(settingsJson);
  const themeId = savedThemeId === "custom" ? savedThemeId : findPreset(savedThemeId)?.id ?? null;
  return {
    themeId,
    surface: settings.surface ?? defaultSurface(themeId),
    hue: settings.hue ?? DEFAULT_HUE,
    font: settings.font ?? DEFAULT_FONT,
    radius: settings.radius ?? DEFAULT_RADIUS,
  };
}

export function themeChoiceSettings({ themeId, surface, hue, font, radius }: ThemeChoice): CustomThemeSettings {
  const settings: CustomThemeSettings = {};
  if (themeId === "custom") settings.hue = hue;
  if (surface !== defaultSurface(themeId)) settings.surface = surface;
  if (font !== DEFAULT_FONT) settings.font = font;
  if (Math.abs(radius - DEFAULT_RADIUS) > 0.01) settings.radius = radius;
  return settings;
}

export function serializeThemeChoice(choice: ThemeChoice): string | null {
  const settings = themeChoiceSettings(choice);
  return Object.keys(settings).length > 0 ? JSON.stringify(settings) : null;
}

export function sameThemeChoice(a: ThemeChoice, b: ThemeChoice) {
  return a.themeId === b.themeId && serializeThemeChoice(a) === serializeThemeChoice(b);
}
