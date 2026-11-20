import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useSoundPreferences = create<{ soundEnabled: boolean; toggleSound: () => void }>()(
  persist(
    (set) => ({
      soundEnabled: true,
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
    }),
    { name: "sound-preferences" },
  ),
);
