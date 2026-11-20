import { useEffect, useRef, useState } from "react";
import { useUserProfile } from "./useUserProfile";
import { endThemeDraft, revealThemeDraft, startThemeDraft, useThemeDraft, useThemeDraftStore } from "./useThemeDraft";
import type { RevealOrigin } from "@/lib/theme-transition";
import { sameThemeChoice, serializeThemeChoice, themeChoiceFromProfile, type ThemeChoice } from "@/lib/theme-choice";

const AUTOSAVE_DELAY_MS = 400;

export function useAppearanceEditor() {
  const { profile, updateProfile } = useUserProfile();
  const draft = useThemeDraft();
  const editing = useThemeDraftStore((s) => s.draft);
  const saved = themeChoiceFromProfile(profile?.accent_color_1 ?? null, profile?.accent_color_2 ?? null);
  const [initial] = useState(saved);
  const pending = useRef<ThemeChoice | null>(null);
  const persist = useRef<(choice: ThemeChoice) => void>(() => {});

  persist.current = (choice) =>
    updateProfile.mutate({ accent_color_1: choice.themeId, accent_color_2: serializeThemeChoice(choice) });

  useEffect(() => {
    startThemeDraft(initial);
    return () => {
      if (pending.current) persist.current(pending.current);
      endThemeDraft();
    };
  }, [initial]);

  const unsaved = editing && !sameThemeChoice(editing, saved) ? editing : null;

  useEffect(() => {
    pending.current = unsaved;
    if (!unsaved) return;
    const choice = unsaved;
    const timer = setTimeout(() => {
      pending.current = null;
      persist.current(choice);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [unsaved]);

  return {
    draft,
    changed: !sameThemeChoice(draft.choice, initial),
    undo: (origin?: RevealOrigin) => revealThemeDraft(initial, origin),
  };
}
