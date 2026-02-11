import { create } from "zustand";

interface GlobalDrawersState {
  quickAddOpen: boolean;
  reconciliationOpen: boolean;
  quickAddDefaultType?: "Ingreso" | "Gasto" | "Inversi\u00f3n";
  openQuickAdd: (type?: "Ingreso" | "Gasto" | "Inversi\u00f3n") => void;
  closeQuickAdd: () => void;
  setQuickAddOpen: (open: boolean) => void;
  openReconciliation: () => void;
  closeReconciliation: () => void;
  setReconciliationOpen: (open: boolean) => void;
}

export const useGlobalDrawers = create<GlobalDrawersState>((set) => ({
  quickAddOpen: false,
  reconciliationOpen: false,
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
}));
