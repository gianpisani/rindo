import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useUserProfile } from "./useUserProfile";
import { applyTheme, cacheTheme, parseCustomSettings } from "@/lib/theme";

export function useCustomTheme() {
  const { profile } = useUserProfile();
  const { resolvedTheme } = useTheme();
  const themeId = profile?.accent_color_1;
  const settingsJson = profile?.accent_color_2;

  useEffect(() => {
    cacheTheme(themeId, settingsJson);
    applyTheme(themeId, parseCustomSettings(settingsJson), resolvedTheme === "dark" ? "dark" : "light");
  }, [themeId, settingsJson, resolvedTheme]);
}
