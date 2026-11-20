import { play, type Sound } from "@/lib/snd";
import { useSoundPreferences } from "./useSoundPreferences";

const fx = (sound: Sound) => () => {
  if (useSoundPreferences.getState().soundEnabled) play(sound);
};

const SOUND_FX = {
  playTap: fx("playTap"),
  playToggleOn: fx("playToggleOn"),
  playToggleOff: fx("playToggleOff"),
  playCelebration: fx("playToggleOn"),
  playCaution: fx("playToggleOn"),
};

export function useSoundFX() {
  return SOUND_FX;
}
