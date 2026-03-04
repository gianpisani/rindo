import { useCallback } from "react";
import { getSnd } from "@/lib/snd";
import { useSoundPreferences } from "./useSoundPreferences";

export function useSoundFX() {
  const { soundEnabled, volume } = useSoundPreferences();

  const play = useCallback(
    (method: "playTap" | "playCelebration" | "playToggleOn" | "playToggleOff" | "playTransitionUp" | "playTransitionDown" | "playCaution" | "playSelect" | "playNotification", relativeVolume: number) => {
      if (!soundEnabled) return;
      const snd = getSnd();
      if (!snd) return;
      snd[method]({ volume: volume * relativeVolume });
    },
    [soundEnabled, volume]
  );

  const playTap = useCallback(() => play("playTap", 0.4), [play]);
  const playCelebration = useCallback(() => play("playCelebration", 0.7), [play]);
  const playToggleOn = useCallback(() => play("playToggleOn", 0.5), [play]);
  const playToggleOff = useCallback(() => play("playToggleOff", 0.5), [play]);
  const playTransitionUp = useCallback(() => play("playTransitionUp", 0.4), [play]);
  const playTransitionDown = useCallback(() => play("playTransitionDown", 0.4), [play]);
  const playCaution = useCallback(() => play("playCaution", 0.5), [play]);
  const playSelect = useCallback(() => play("playSelect", 0.5), [play]);
  const playNotification = useCallback(() => play("playNotification", 0.3), [play]);

  return {
    playTap,
    playCelebration,
    playToggleOn,
    playToggleOff,
    playTransitionUp,
    playTransitionDown,
    playCaution,
    playSelect,
    playNotification,
  };
}
