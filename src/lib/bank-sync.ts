export type BankSyncTab = "sync" | "settings" | "history";
export type BankSyncView = "form" | "polling" | "result";

export const SYNC_STATUS_MESSAGES: Record<string, string> = {
  queued: "En cola, iniciando conexión...",
  running: "Conectando con tu banco...",
  awaiting_2fa: "Esperando aprobación 2FA en tu app del banco...",
};

export function bankSyncView(step: string, hasResult: boolean): BankSyncView {
  const showPolling = step === "submitting" || step === "polling";
  const showResult = step === "completed" || (step === "failed" && hasResult);
  return showResult ? "result" : showPolling ? "polling" : "form";
}

export function hasBankSyncFooter(view: BankSyncView, hasBank: boolean, hasResult: boolean): boolean {
  return (view === "form" && hasBank) || view === "polling" || (view === "result" && hasResult);
}

export function bankSyncTitle(tab: BankSyncTab, view: BankSyncView, bankLabel: string | undefined): string {
  if (tab === "settings") return "Auto-sync";
  if (tab === "history") return "Historial";
  return view === "form" && bankLabel !== undefined ? bankLabel : "Sincronizar Banco";
}

export function formatMovementDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3 && parts[0].length <= 2) return `${parts[0]}/${parts[1]}`;
  if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}/${parts[1]}`;
  return dateStr;
}

export function isCreatableSkip(item: { reason?: string }): boolean {
  return item.reason !== "zero_amount";
}

export function creatableIndexes(items: { reason?: string }[]): number[] {
  return items.map((item, i) => (isCreatableSkip(item) ? i : -1)).filter((i) => i !== -1);
}

export function toggleIndex(selected: Set<number>, index: number): Set<number> {
  const next = new Set(selected);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  return next;
}

export function toggleAllIndexes(selected: Set<number>, indexes: number[]): Set<number> {
  const allSelected = indexes.every((i) => selected.has(i));
  return allSelected ? new Set() : new Set(indexes);
}

export function selectedItemIds(items: { id?: string }[], selected: Set<number>): string[] {
  return items
    .filter((item, i) => selected.has(i) && item.id)
    .map((item) => item.id as string);
}

export type SyncStep = "idle" | "submitting" | "polling" | "completed" | "failed";

export interface SyncMovementItem {
  id?: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  reason?: string;
  card?: string;
}

export type SyncResult =
  | { imported: number; skipped: number; importedItems: SyncMovementItem[]; skippedItems: SyncMovementItem[] }
  | { error: string };

export function toApiDate(yyyymmdd: string): string {
  const [yyyy, mm, dd] = yyyymmdd.split("-");
  return `${dd}-${mm}-${yyyy}`;
}
