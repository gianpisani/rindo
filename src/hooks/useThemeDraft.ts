import { flushSync } from "react-dom";
import { create } from "zustand";
import { useTheme } from "next-themes";
import type { Surface, ThemeMode } from "@/lib/theme";
import { INITIAL_THEME_CHOICE, type ThemeChoice } from "@/lib/theme-choice";
import { resolveColorMode, revealTheme, type RevealOrigin } from "@/lib/theme-transition";

export type ColorMode = ThemeMode | "system";

export const useThemeDraftStore = create<{ draft: ThemeChoice | null }>(() => ({ draft: null }));

export const startThemeDraft = (choice: ThemeChoice) => useThemeDraftStore.setState({ draft: choice });

export const endThemeDraft = () => useThemeDraftStore.setState({ draft: null });

export const revealThemeDraft = (choice: ThemeChoice, origin?: RevealOrigin) =>
  revealTheme(() => flushSync(() => startThemeDraft(choice)), origin);

const currentDraft = () => useThemeDraftStore.getState().draft ?? INITIAL_THEME_CHOICE;

const patchDraft = (patch: Partial<ThemeChoice>, origin?: RevealOrigin) =>
  revealThemeDraft({ ...currentDraft(), ...patch }, origin);

export function useResolvedMode(): ThemeMode | undefined {
  const { resolvedTheme } = useTheme();
  if (resolvedTheme === "light" || resolvedTheme === "dark") return resolvedTheme;
  return undefined;
}

export function useColorMode() {
  const { theme, setTheme } = useTheme();
  return {
    colorMode: (theme ?? "system") as ColorMode,
    setColorMode: (mode: ColorMode, origin?: RevealOrigin) =>
      revealTheme(() => {
        document.documentElement.classList.toggle("dark", resolveColorMode(mode) === "dark");
        flushSync(() => setTheme(mode));
      }, origin),
  };
}

export function useThemeDraft() {
  const { colorMode, setColorMode } = useColorMode();
  const currentMode = useResolvedMode() ?? "dark";
  const choice = useThemeDraftStore((s) => s.draft) ?? INITIAL_THEME_CHOICE;

  return {
    colorMode,
    currentMode,
    choice,
    selectAccent: (themeId: string | null, origin?: RevealOrigin) => patchDraft({ themeId }, origin),
    selectSurface: (surface: Surface, origin?: RevealOrigin) => patchDraft({ surface }, origin),
    changeHue: (hue: number) => patchDraft({ hue, themeId: "custom" }),
    changeFont: (font: string, origin?: RevealOrigin) => patchDraft({ font }, origin),
    changeRadius: (radius: number) => patchDraft({ radius }),
    changeMode: setColorMode,
  };
}

export type ThemeDraft = ReturnType<typeof useThemeDraft>;
