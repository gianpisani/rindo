import { create } from "zustand";
import { useTheme } from "next-themes";
import { generatePaletteFromHue, type ThemeMode } from "@/lib/theme";
import { INITIAL_THEME_CHOICE, type ThemeChoice } from "@/lib/theme-choice";

export type ColorMode = ThemeMode | "system";

export const useThemeDraftStore = create<{ draft: ThemeChoice | null }>(() => ({ draft: null }));

export const startThemeDraft = (choice: ThemeChoice) => useThemeDraftStore.setState({ draft: choice });

export const endThemeDraft = () => useThemeDraftStore.setState({ draft: null });

const patchDraft = (patch: Partial<ThemeChoice>) =>
  useThemeDraftStore.setState(({ draft }) => ({ draft: { ...(draft ?? INITIAL_THEME_CHOICE), ...patch } }));

export function useResolvedMode(): ThemeMode | undefined {
  const { resolvedTheme } = useTheme();
  if (resolvedTheme === "light" || resolvedTheme === "dark") return resolvedTheme;
  return undefined;
}

export function useThemeDraft() {
  const { theme, setTheme } = useTheme();
  const currentMode = useResolvedMode() ?? "dark";
  const choice = useThemeDraftStore((s) => s.draft) ?? INITIAL_THEME_CHOICE;

  return {
    colorMode: (theme ?? "system") as ColorMode,
    currentMode,
    choice,
    customPalette: generatePaletteFromHue(choice.hue, currentMode),
    selectTheme: (themeId: string | null) => patchDraft({ themeId }),
    changeHue: (hue: number) => patchDraft({ hue, themeId: "custom" }),
    changeFont: (font: string) => patchDraft({ font }),
    changeRadius: (radius: number) => patchDraft({ radius }),
    changeMode: (mode: ColorMode) => setTheme(mode),
  };
}

export type ThemeDraft = ReturnType<typeof useThemeDraft>;
