import { useMemo } from "react";
import { play, type Sound } from "@/lib/snd";
import { useSoundPreferences } from "./useSoundPreferences";

export function useSoundFX() {
  const enabled = useSoundPreferences((s) => s.soundEnabled);
  return useMemo(() => {
    const fx = (sound: Sound) => () => {
      if (enabled) play(sound);
    };
    return {
      playTap: fx("playTap"),
      playToggleOn: fx("playToggleOn"),
      playToggleOff: fx("playToggleOff"),
      playCelebration: fx("playToggleOn"),
      playCaution: fx("playToggleOn"),
    };
  }, [enabled]);
}
