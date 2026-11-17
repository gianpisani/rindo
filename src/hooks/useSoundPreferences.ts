import { create } from "zustand";
import { persist } from "zustand/middleware";

// Un único on/off. Misma clave de localStorage de siempre ("sound-preferences"),
// así quien apagó los sonidos los sigue teniendo apagados.
export const useSoundPreferences = create<{ soundEnabled: boolean; toggleSound: () => void }>()(
  persist(
    (set) => ({
      soundEnabled: true,
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
    }),
    { name: "sound-preferences" },
  ),
);
