import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SoundPreferencesState {
  soundEnabled: boolean;
  volume: number;
  toggleSound: () => void;
  setVolume: (v: number) => void;
}

export const useSoundPreferences = create<SoundPreferencesState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      volume: 0.5,
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      setVolume: (v: number) => set({ volume: Math.max(0, Math.min(1, v)) }),
    }),
    {
      name: 'sound-preferences',
    }
  )
);
