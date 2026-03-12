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

  const playToggleOn = useCallback(() => play("playToggleOn", 0.5), [play]);
  const playToggleOff = useCallback(() => play("playToggleOff", 0.5), [play]);
  const playTap = useCallback(() => play("playTap", 0.5), [play]);
  const playCelebration = useCallback(() => play("playToggleOn", 0.5), [play]);
  const playTransitionUp = useCallback(() => play("playToggleOn", 0.5), [play]);
  const playTransitionDown = useCallback(() => play("playToggleOff", 0.5), [play]);
  const playCaution = useCallback(() => play("playToggleOn", 0.5), [play]);
  const playSelect = useCallback(() => play("playToggleOn", 0.5), [play]);
  const playNotification = useCallback(() => play("playToggleOn", 0.5), [play]);

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
