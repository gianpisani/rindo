import { useBankSyncCredentials } from "@/hooks/useBankSyncCredentials";

export function useLastBankSync() {
  const { data: bankCredentials } = useBankSyncCredentials();
  return (bankCredentials ?? [])
    .filter((c) => c.is_active && c.last_sync_status === "success" && c.last_sync_at)
    .map((c) => c.last_sync_at as string)
    .sort()
    .at(-1);
}
