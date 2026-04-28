import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SyncScheduleId } from "@/lib/banks";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BankCredential {
  bank: string;
  rut: string;
  is_active: boolean;
  sync_schedule: SyncScheduleId;
  last_sync_at: string | null;
  last_sync_status: "success" | "failed" | "2fa_blocked" | "invalid_credentials" | null;
  last_error: string | null;
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function callBankSync(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("bank-sync", { body });
  if (error) throw error;
  return data;
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useBankSyncCredentials() {
  return useQuery<BankCredential[]>({
    queryKey: ["bank-sync-credentials"],
    queryFn: async () => {
      const data = await callBankSync({ action: "list-credentials" });
      return (data?.credentials ?? []) as BankCredential[];
    },
    staleTime: 30_000,
  });
}

export function useSaveCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { bank: string; rut: string; password: string; syncSchedule?: SyncScheduleId }) =>
      callBankSync({ action: "save-credentials", ...params }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank-sync-credentials"] }),
  });
}

export function useDeleteCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bank: string) =>
      callBankSync({ action: "delete-credentials", bank }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank-sync-credentials"] }),
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { bank: string; syncSchedule: SyncScheduleId }) =>
      callBankSync({ action: "update-schedule", bank: params.bank, syncSchedule: params.syncSchedule }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank-sync-credentials"] }),
  });
}
