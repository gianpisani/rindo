import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PrivacyModeState {
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
}

export const usePrivacyMode = create<PrivacyModeState>()(
  persist(
    (set) => ({
      isPrivacyMode: false,
      togglePrivacyMode: () => set((state) => ({ isPrivacyMode: !state.isPrivacyMode })),
    }),
    {
      name: 'privacy-mode-storage',
    }
  )
);

