import { create } from "zustand";

interface GlobalDrawersState {
  quickAddOpen: boolean;
  reconciliationOpen: boolean;
  profileEditOpen: boolean;
  quickAddDefaultType?: "Ingreso" | "Gasto" | "Inversión" | "Reembolso";
  openQuickAdd: (type?: "Ingreso" | "Gasto" | "Inversión" | "Reembolso") => void;
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
    set({
      quickAddOpen: open,
      ...(open ? {} : { quickAddDefaultType: undefined }),
    }),
  openReconciliation: () => set({ reconciliationOpen: true }),
  closeReconciliation: () => set({ reconciliationOpen: false }),
  setReconciliationOpen: (open) => set({ reconciliationOpen: open }),
  openProfileEdit: () => set({ profileEditOpen: true }),
  setProfileEditOpen: (open) => set({ profileEditOpen: open }),
}));
