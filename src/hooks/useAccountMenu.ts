import { useSignOut, useUserEmail } from "./useAccount";
import { useGlobalDrawers } from "./useGlobalDrawers";
import { usePeriodConfig } from "./usePeriodConfig";
import { usePushNotifications } from "./usePushNotifications";
import { useSoundFX } from "./useSoundFX";
import { useSoundPreferences } from "./useSoundPreferences";
import { useUserProfile } from "./useUserProfile";
import { useColorMode } from "./useThemeDraft";
import { periodShortLabel } from "@/lib/period";
import { initialsOf, profileDisplayName } from "@/lib/profile-name";

export function useAccountMenu() {
  const { profile, avatarUrl } = useUserProfile();
  const email = useUserEmail();
  const { startDay } = usePeriodConfig();
  const { colorMode, setColorMode } = useColorMode();
  const { soundEnabled, toggleSound } = useSoundPreferences();
  const { playToggleOn } = useSoundFX();
  const push = usePushNotifications();
  const signOut = useSignOut();
  const { openProfileEdit, openAppearance, openPeriodSettings } = useGlobalDrawers();
  const name = profileDisplayName(profile);

  return {
    name: name || "Tu perfil",
    email,
    avatarUrl,
    initials: initialsOf(name || email || "?"),
    periodLabel: periodShortLabel(startDay),
    colorMode,
    setColorMode,
    soundEnabled,
    toggleSound: () => {
      toggleSound();
      playToggleOn();
    },
    push,
    openProfile: openProfileEdit,
    openAppearance,
    openPeriod: openPeriodSettings,
    signOut: () => signOut.mutate(),
  };
}

export type AccountMenu = ReturnType<typeof useAccountMenu>;
