import { useEffect } from "react";
import { useUserProfile } from "./useUserProfile";
import { useResolvedMode, useThemeDraftStore } from "./useThemeDraft";
import { applyTheme, cacheTheme } from "@/lib/theme";
import { themeChoiceFromProfile, themeChoiceSettings } from "@/lib/theme-choice";

export function useCustomTheme() {
  const { profile } = useUserProfile();
  const draft = useThemeDraftStore((s) => s.draft);
  const mode = useResolvedMode();
  const themeId = profile?.accent_color_1 ?? null;
  const settingsJson = profile?.accent_color_2 ?? null;
  const profileLoaded = profile !== undefined;

  useEffect(() => {
    if (profileLoaded) cacheTheme(themeId, settingsJson);
  }, [profileLoaded, themeId, settingsJson]);

  useEffect(() => {
    if (!mode || (!profileLoaded && !draft)) return;
    const choice = draft ?? themeChoiceFromProfile(themeId, settingsJson);
    applyTheme(choice.themeId, themeChoiceSettings(choice), mode);
  }, [draft, mode, profileLoaded, themeId, settingsJson]);
}
