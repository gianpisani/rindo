import { useMemo } from "react";
import { play, type Sound } from "@/lib/snd";
import { useSoundPreferences } from "./useSoundPreferences";

// Nombres que usan los componentes → sonido real.
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
      playSelect: fx("playToggleOn"),
    };
  }, [enabled]);
}
