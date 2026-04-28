import { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// "YYYY-MM-DD" (native date input) → "DD-MM-YYYY" (API format)
function toApiDate(yyyymmdd: string): string {
  const [yyyy, mm, dd] = yyyymmdd.split("-");
  return `${dd}-${mm}-${yyyy}`;
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface BankSyncContextValue {
  step: SyncStep;
  pollStatus: string;
  result: SyncResult | null;
  isRunning: boolean;
  startSync: (params: { bank: string; rut: string; password: string; fromDate?: string; toDate?: string }) => void;
  startSyncStored: (params: { bank: string; fromDate?: string; toDate?: string }) => void;
  importSkipped: (movements: SyncMovementItem[]) => Promise<number>;
  deleteImported: (ids: string[]) => Promise<number>;
  reset: () => void;
}

const BankSyncContext = createContext<BankSyncContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function BankSyncProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [step, setStep] = useState<SyncStep>("idle");
  const [pollStatus, setPollStatus] = useState<string>("queued");
  const [result, setResult] = useState<SyncResult | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const isCallingRef = useRef(false);

  function stopPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }

  const reset = useCallback(() => {
    stopPolling();
    pollCountRef.current = 0;
    isCallingRef.current = false;
    setStep("idle");
    setPollStatus("queued");
    setResult(null);
  }, []);

  // ── Polling ─────────────────────────────────────────────────────────────

  function startPolling(jobId: string) {
    stopPolling();
    pollCountRef.current = 0;
    pollIntervalRef.current = setInterval(() => pollJob(jobId), 3000);
  }

  async function pollJob(jobId: string) {
    if (isCallingRef.current) return;
    isCallingRef.current = true;
    try {
      pollCountRef.current += 1;

      if (pollCountRef.current > 40) {
        stopPolling();
        setResult({ error: "La sincronización tardó demasiado. Intenta de nuevo." });
        setStep("failed");
        toast.error("La sincronización tardó demasiado");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("bank-sync", {
          body: { action: "check", jobId },
        });

        if (error) {
          stopPolling();
          setResult({ error: "Error al consultar el estado de la sincronización." });
          setStep("failed");
          toast.error("Error al sincronizar el banco");
          return;
        }

        if (data.status === "completed") {
          stopPolling();
          const res = {
            imported: data.imported as number,
            skipped: data.skipped as number,
            importedItems: (data.importedItems ?? []) as SyncMovementItem[],
            skippedItems: (data.skippedItems ?? []) as SyncMovementItem[],
          };
          setResult(res);
          setStep("completed");
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          if (res.imported > 0) {
            toast.success(
              `Banco sincronizado: ${res.imported} transacción${res.imported !== 1 ? "es" : ""} importada${res.imported !== 1 ? "s" : ""}`
            );
          } else {
            toast.info("Sincronización completada. No había transacciones nuevas.");
          }
          return;
        }

        if (data.status === "failed") {
          stopPolling();
          setResult({ error: data.error ?? "El banco reportó un error." });
          setStep("failed");
          toast.error("Error al sincronizar el banco");
          return;
        }

        setPollStatus(data.status);
      } catch {
        // Network hiccup — keep polling
      }
    } finally {
      isCallingRef.current = false;
    }
  }

  // ── Start ────────────────────────────────────────────────────────────────

  const startSync = useCallback(
    async (params: { bank: string; rut: string; password: string; fromDate?: string; toDate?: string }) => {
      setStep("submitting");

      try {
        const body: Record<string, string> = {
          action: "start",
          bank: params.bank,
          rut: params.rut,
          password: params.password,
        };
        if (params.fromDate) body.fromDate = toApiDate(params.fromDate);
        if (params.toDate) body.toDate = toApiDate(params.toDate);

        const { data, error } = await supabase.functions.invoke("bank-sync", { body });

        console.error("[bank-sync start] error:", error, "data:", data);

        if (error) {
          setResult({ error: error.message || "Error al llamar la función de sincronización." });
          setStep("failed");
          return;
        }
        if (!data?.jobId) {
          setResult({ error: data?.error || "La API no devolvió un jobId. Revisa las credenciales." });
          setStep("failed");
          return;
        }

        setPollStatus(data.status ?? "queued");
        setStep("polling");
        startPolling(data.jobId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error de red. Intenta de nuevo.";
        console.error("[bank-sync start] catch:", e);
        setResult({ error: msg });
        setStep("failed");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient]
  );

  const startSyncStored = useCallback(
    async (params: { bank: string; fromDate?: string; toDate?: string }) => {
      setStep("submitting");

      try {
        const body: Record<string, string> = {
          action: "start-stored",
          bank: params.bank,
        };
        if (params.fromDate) body.fromDate = toApiDate(params.fromDate);
        if (params.toDate) body.toDate = toApiDate(params.toDate);

        const { data, error } = await supabase.functions.invoke("bank-sync", { body });

        if (error) {
          setResult({ error: error.message || "Error al llamar la función de sincronización." });
          setStep("failed");
          return;
        }
        if (!data?.jobId) {
          setResult({ error: data?.error || "La API no devolvió un jobId." });
          setStep("failed");
          return;
        }

        setPollStatus(data.status ?? "queued");
        setStep("polling");
        startPolling(data.jobId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error de red. Intenta de nuevo.";
        setResult({ error: msg });
        setStep("failed");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient]
  );

  const importSkipped = useCallback(
    async (movements: SyncMovementItem[]): Promise<number> => {
      try {
        const { data, error } = await supabase.functions.invoke("bank-sync", {
          body: { action: "import-skipped", movements },
        });
        if (error || !data) {
          toast.error("Error al importar transacciones");
          return 0;
        }
        const created = data.created as number;
        if (created > 0) {
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          toast.success(`${created} transacción${created !== 1 ? "es" : ""} importada${created !== 1 ? "s" : ""}`);
        }
        return created;
      } catch {
        toast.error("Error de red al importar transacciones");
        return 0;
      }
    },
    [queryClient]
  );

  const deleteImported = useCallback(
    async (ids: string[]): Promise<number> => {
      try {
        const { data, error } = await supabase.functions.invoke("bank-sync", {
          body: { action: "delete-imported", ids },
        });
        if (error || !data) {
          toast.error("Error al eliminar transacciones");
          return 0;
        }
        const deleted = data.deleted as number;
        if (deleted > 0) {
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          toast.success(`${deleted} transacción${deleted !== 1 ? "es" : ""} eliminada${deleted !== 1 ? "s" : ""}`);
        }
        return deleted;
      } catch {
        toast.error("Error de red al eliminar transacciones");
        return 0;
      }
    },
    [queryClient]
  );

  return (
    <BankSyncContext.Provider
      value={{
        step,
        pollStatus,
        result,
        isRunning: step === "submitting" || step === "polling",
        startSync,
        startSyncStored,
        importSkipped,
        deleteImported,
        reset,
      }}
    >
      {children}
    </BankSyncContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useBankSyncContext() {
  const ctx = useContext(BankSyncContext);
  if (!ctx) throw new Error("useBankSyncContext must be used inside BankSyncProvider");
  return ctx;
}
