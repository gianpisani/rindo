import { create } from "zustand";
import type { TransactionType } from "@/lib/ledger";

interface GlobalDrawersState {
  quickAddOpen: boolean;
  reconciliationOpen: boolean;
  profileEditOpen: boolean;
  quickAddDefaultType?: TransactionType;
  openQuickAdd: (type?: TransactionType) => void;
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
  openQuickAdd: (type) =>
    set({ quickAddOpen: true, quickAddDefaultType: type }),
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
