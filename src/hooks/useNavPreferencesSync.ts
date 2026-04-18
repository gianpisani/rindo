import { useEffect, useRef } from "react";
import { useNavPreferences } from "@/hooks/useNavPreferences";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";

/**
 * Syncs nav preferences between Zustand (localStorage) and Supabase.
 *
 * Strategy:
 * - On mount: if Supabase has nav_preferences and local is default, hydrate from Supabase
 * - On local change: debounce-save to Supabase
 *
 * This gives instant local performance + cross-device sync.
 */
export function useNavPreferencesSync() {
  const { profile } = useUserProfile();
  const {
    sidebarOrder,
    hiddenRoutes,
    mobileTabs,
    setSidebarOrder,
    setMobileTabs,
  } = useNavPreferences();

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const hasHydratedRef = useRef(false);

  // Hydrate from Supabase on first load (if remote has data)
  useEffect(() => {
    if (!profile || hasHydratedRef.current) return;
    hasHydratedRef.current = true;

    const remote = profile.nav_preferences;
    if (!remote) return;

    // Check if local storage has been customized (not first visit)
    const localRaw = localStorage.getItem("nav-preferences-storage");
    if (localRaw) {
      // User already has local preferences - local wins
      // But trigger a save to sync local → remote
      return;
    }

    // First time on this device - hydrate from Supabase
    if (remote.sidebarOrder) setSidebarOrder(remote.sidebarOrder);
    if (remote.mobileTabs) {
      useNavPreferences.setState({ mobileTabs: remote.mobileTabs });
    }
    if (remote.hiddenRoutes) {
      useNavPreferences.setState({ hiddenRoutes: remote.hiddenRoutes });
    }
  }, [profile, setSidebarOrder, setMobileTabs]);

  // Save to Supabase on change (debounced)
  useEffect(() => {
    if (!profile) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        await supabase
          .from("user_profiles")
          .update({
            nav_preferences: {
              sidebarOrder,
              hiddenRoutes,
              mobileTabs,
            },
          })
          .eq("user_id", userData.user.id);
      } catch {
        // Silent fail - localStorage is the source of truth
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [profile, sidebarOrder, hiddenRoutes, mobileTabs]);
}
