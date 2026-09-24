import { create } from "zustand";
import type { TransactionType } from "@/lib/ledger";
import type { WhisperDraft } from "@/lib/whisper";

interface GlobalDrawersState {
  quickAddOpen: boolean;
  reconciliationOpen: boolean;
  profileEditOpen: boolean;
  quickAddDefaultType?: TransactionType;
  quickAddDraft?: WhisperDraft;
  quickAddRevision: number;
  pendingShared: { id: string; amount: number } | null;
  setPendingShared: (transaction: { id: string; amount: number } | null) => void;
  openQuickAdd: (type?: TransactionType, draft?: WhisperDraft) => void;
  closeQuickAdd: () => void;
  setQuickAddOpen: (open: boolean) => void;
  openReconciliation: () => void;
  closeReconciliation: () => void;
  setReconciliationOpen: (open: boolean) => void;
  openProfileEdit: () => void;
  setProfileEditOpen: (open: boolean) => void;
}

export const useGlobalDrawers = create<GlobalDrawersState>((set) => ({
  quickAddOpen: false,
  reconciliationOpen: false,
  profileEditOpen: false,
  quickAddDefaultType: undefined,
  quickAddRevision: 0,
  pendingShared: null,
  setPendingShared: (pendingShared) => set({ pendingShared }),
  openQuickAdd: (type, draft) =>
    set(state => ({ quickAddOpen: true, quickAddDefaultType: type, quickAddDraft: draft, quickAddRevision: state.quickAddRevision + 1 })),
  closeQuickAdd: () =>
    set({ quickAddOpen: false, quickAddDefaultType: undefined }),
  setQuickAddOpen: (open) =>
    set((state) => ({
      quickAddOpen: open,
      ...(open ? {} : { quickAddDefaultType: state.quickAddDefaultType }),
    })),
  openReconciliation: () => set({ reconciliationOpen: true }),
  closeReconciliation: () => set({ reconciliationOpen: false }),
  setReconciliationOpen: (open) => set({ reconciliationOpen: open }),
  openProfileEdit: () => set({ profileEditOpen: true }),
  setProfileEditOpen: (open) => set({ profileEditOpen: open }),
}));
