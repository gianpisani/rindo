import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SyncScheduleId } from "@/lib/banks";
import { optimistic } from "./optimistic";

export interface BankCredential {
  bank: string;
  rut: string;
  is_active: boolean;
  sync_schedule: SyncScheduleId;
  notify_email: boolean;
  last_sync_at: string | null;
  last_sync_status: "success" | "failed" | "2fa_blocked" | "invalid_credentials" | null;
  last_error: string | null;
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
}

const CREDENTIALS_KEY = ["bank-sync-credentials"];

export function invokeBankSync(body: Record<string, unknown>) {
  return supabase.functions.invoke("bank-sync", { body });
}

async function callBankSync(body: Record<string, unknown>) {
  const { data, error } = await invokeBankSync(body);
  if (error) throw error;
  return data;
}

function useCredentialPatch<TVariables extends { bank: string }>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  patch: (variables: TVariables) => Partial<BankCredential>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    ...optimistic<BankCredential[], TVariables>(queryClient, CREDENTIALS_KEY, (list, variables) =>
      list.map((c) => (c.bank === variables.bank ? { ...c, ...patch(variables) } : c))),
  });
}

async function updateCredentialRow(bank: string, changes: Partial<BankCredential>) {
  const { error } = await supabase.from("bank_sync_credentials").update(changes).eq("bank", bank);
  if (error) throw error;
}

export function useBankSyncCredentials() {
  return useQuery<BankCredential[]>({
    queryKey: CREDENTIALS_KEY,
    queryFn: async () => {
      const data = await callBankSync({ action: "list-credentials" });
      return (data?.credentials ?? []) as BankCredential[];
    },
    staleTime: 30_000,
  });
}

export function useSaveCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { bank: string; rut: string; password: string; syncSchedule?: SyncScheduleId; notifyEmail?: boolean }) =>
      callBankSync({ action: "save-credentials", ...params }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CREDENTIALS_KEY }),
  });
}

export function useDeleteCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bank: string) => callBankSync({ action: "delete-credentials", bank }),
    ...optimistic<BankCredential[], string>(queryClient, CREDENTIALS_KEY, (list, bank) => list.filter((c) => c.bank !== bank)),
  });
}

export function useUpdateSchedule() {
  return useCredentialPatch(
    (params: { bank: string; syncSchedule: SyncScheduleId }) =>
      callBankSync({ action: "update-schedule", bank: params.bank, syncSchedule: params.syncSchedule }),
    ({ syncSchedule }) => ({ sync_schedule: syncSchedule }),
  );
}

export function useUpdateActive() {
  return useCredentialPatch(
    ({ bank, isActive }: { bank: string; isActive: boolean }) =>
      updateCredentialRow(bank, { is_active: isActive, ...(isActive ? { consecutive_failures: 0, last_error: null } : {}) }),
    ({ isActive }) => ({ is_active: isActive }),
  );
}

export function useUpdateNotifyEmail() {
  return useCredentialPatch(
    ({ bank, notifyEmail }: { bank: string; notifyEmail: boolean }) => updateCredentialRow(bank, { notify_email: notifyEmail }),
    ({ notifyEmail }) => ({ notify_email: notifyEmail }),
  );
}
