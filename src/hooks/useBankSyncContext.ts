import { createContext, useContext } from "react";
import type { SyncMovementItem, SyncResult, SyncStep } from "@/lib/bank-sync";

export interface BankSyncContextValue {
  step: SyncStep;
  pollStatus: string;
  result: SyncResult | null;
  isRunning: boolean;
  startSync: (params: { bank: string; rut: string; password: string; fromDate?: string; toDate?: string }) => void;
  startSyncStored: (params: { bank: string; fromDate?: string; toDate?: string }) => void;
  importSkipped: (movements: SyncMovementItem[], bank?: string) => Promise<number>;
  deleteImported: (ids: string[]) => Promise<number>;
  reset: () => void;
}

export const BankSyncContext = createContext<BankSyncContextValue | null>(null);

export function useBankSyncContext() {
  const ctx = useContext(BankSyncContext);
  if (!ctx) throw new Error("useBankSyncContext must be used inside BankSyncProvider");
  return ctx;
}
