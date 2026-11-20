import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/integrations/supabase/session";

export interface ImportedItem {
  id?: string;
  date: string;
  description: string;
  amount: number;
  type: string;
}

export interface SkippedItem {
  date: string;
  description: string;
  amount: number;
  type: string;
  reason: string;
  card?: string;
}

export interface SyncLogEntry {
  id: string;
  bank: string;
  trigger: "cron" | "manual";
  sync_date: string;
  imported: number;
  skipped: number;
  status: "success" | "failed" | "2fa_blocked" | "invalid_credentials";
  error: string | null;
  imported_items: ImportedItem[] | null;
  skipped_items: SkippedItem[] | null;
}

const RECENT_SYNCS = 10;

export function useBankSyncLog() {
  return useQuery({
    queryKey: ["bank-sync-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_sync_log")
        .select("*")
        .eq("user_id", await requireUserId())
        .order("sync_date", { ascending: false })
        .limit(RECENT_SYNCS);
      if (error) throw error;
      return data as unknown as SyncLogEntry[];
    },
    staleTime: 30_000,
  });
}
