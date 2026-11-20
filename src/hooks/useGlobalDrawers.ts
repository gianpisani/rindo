import { create } from "zustand";
import type { TransactionType } from "@/lib/ledger";
import type { WhisperDraft } from "@/lib/whisper";

interface GlobalDrawersState {
  quickAddOpen: boolean;
  reconciliationOpen: boolean;
  profileEditOpen: boolean;
  periodSettingsOpen: boolean;
  appearanceOpen: boolean;
  quickAddDefaultType?: TransactionType;
  quickAddDraft?: WhisperDraft;
  quickAddRevision: number;
  pendingShared: { id: string; amount: number } | null;
  setPendingShared: (transaction: { id: string; amount: number } | null) => void;
  openQuickAdd: (type?: TransactionType, draft?: WhisperDraft) => void;
  setQuickAddOpen: (open: boolean) => void;
  openReconciliation: () => void;
  setReconciliationOpen: (open: boolean) => void;
  openProfileEdit: () => void;
  setProfileEditOpen: (open: boolean) => void;
  openPeriodSettings: () => void;
  setPeriodSettingsOpen: (open: boolean) => void;
  openAppearance: () => void;
  setAppearanceOpen: (open: boolean) => void;
}

export const useGlobalDrawers = create<GlobalDrawersState>((set) => ({
  quickAddOpen: false,
  reconciliationOpen: false,
  profileEditOpen: false,
  periodSettingsOpen: false,
  appearanceOpen: false,
  quickAddDefaultType: undefined,
  quickAddRevision: 0,
  pendingShared: null,
  setPendingShared: (pendingShared) => set({ pendingShared }),
  openQuickAdd: (type, draft) =>
    set(state => ({ quickAddOpen: true, quickAddDefaultType: type, quickAddDraft: draft, quickAddRevision: state.quickAddRevision + 1 })),
  setQuickAddOpen: (open) => set({ quickAddOpen: open }),
  openReconciliation: () => set({ reconciliationOpen: true }),
  setReconciliationOpen: (open) => set({ reconciliationOpen: open }),
  openProfileEdit: () => set({ profileEditOpen: true }),
  setProfileEditOpen: (open) => set({ profileEditOpen: open }),
  openPeriodSettings: () => set({ periodSettingsOpen: true }),
  setPeriodSettingsOpen: (open) => set({ periodSettingsOpen: open }),
  openAppearance: () => set({ appearanceOpen: true }),
  setAppearanceOpen: (open) => set({ appearanceOpen: open }),
}));
