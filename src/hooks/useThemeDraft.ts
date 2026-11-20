import { useCallback, useState } from "react";
import { useTheme } from "next-themes";
import {
  applyFontPreview,
  applyRadiusPreview,
  applyThemePreview,
  generatePaletteFromHue,
} from "@/lib/theme";
import { INITIAL_THEME_CHOICE, serializeThemeChoice, type ThemeChoice } from "@/lib/theme-choice";

export type ColorMode = "light" | "dark" | "system";

export function useThemeDraft() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<string | null>(INITIAL_THEME_CHOICE.themeId);
  const [customHue, setCustomHue] = useState(INITIAL_THEME_CHOICE.hue);
  const [selectedFont, setSelectedFont] = useState<string>(INITIAL_THEME_CHOICE.font);
  const [customRadius, setCustomRadius] = useState(INITIAL_THEME_CHOICE.radius);

  const currentMode = (resolvedTheme || "dark") as "light" | "dark";

  const load = useCallback((choice: ThemeChoice) => {
    setSelectedTheme(choice.themeId);
    setCustomHue(choice.hue);
    setSelectedFont(choice.font);
    setCustomRadius(choice.radius);
  }, []);

  const buildCustomSettings = useCallback(
    () =>
      serializeThemeChoice({
        themeId: selectedTheme,
        hue: customHue,
        font: selectedFont,
        radius: customRadius,
      }),
    [selectedTheme, customHue, selectedFont, customRadius]
  );

  const selectTheme = useCallback(
    (themeId: string | null) => {
      setSelectedTheme(themeId);
      applyThemePreview(themeId, currentMode, { hue: customHue });
    },
    [currentMode, customHue]
  );

  const changeHue = useCallback(
    (hue: number) => {
      setCustomHue(hue);
      setSelectedTheme("custom");
      applyThemePreview("custom", currentMode, { hue });
    },
    [currentMode]
  );

  const changeFont = useCallback((fontId: string) => {
    setSelectedFont(fontId);
    applyFontPreview(fontId);
  }, []);

  const changeRadius = useCallback((radius: number) => {
    setCustomRadius(radius);
    applyRadiusPreview(radius);
  }, []);

  const changeMode = useCallback(
    (value: ColorMode) => {
      setTheme(value);
      const newMode =
        value === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
          : value;
      setTimeout(() => {
        applyThemePreview(selectedTheme, newMode, { hue: customHue });
      }, 50);
    },
    [selectedTheme, setTheme, customHue]
  );

  return {
    colorMode: theme ?? "system",
    currentMode,
    selectedTheme,
    customHue,
    customPalette: generatePaletteFromHue(customHue, currentMode),
    selectedFont,
    customRadius,
    load,
    buildCustomSettings,
    selectTheme,
    changeHue,
    changeFont,
    changeRadius,
    changeMode,
  };
}

export type ThemeDraft = ReturnType<typeof useThemeDraft>;
