import { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/lib/errors";

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

function toApiDate(yyyymmdd: string): string {
  const [yyyy, mm, dd] = yyyymmdd.split("-");
  return `${dd}-${mm}-${yyyy}`;
}

interface BankSyncContextValue {
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

const BankSyncContext = createContext<BankSyncContextValue | null>(null);

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
      } catch (error) {
        console.warn("Falló una consulta de la sincronización; se reintenta", error);
      }
    } finally {
      isCallingRef.current = false;
    }
  }

  const start = useCallback(
    async (body: Record<string, string>, range: { fromDate?: string; toDate?: string }) => {
      setStep("submitting");
      if (range.fromDate) body.fromDate = toApiDate(range.fromDate);
      if (range.toDate) body.toDate = toApiDate(range.toDate);
      try {
        const { data, error } = await supabase.functions.invoke("bank-sync", { body });
        if (error || !data?.jobId) {
          setResult({ error: data?.error || errorMessage(error) });
          setStep("failed");
          return;
        }
        setPollStatus(data.status ?? "queued");
        setStep("polling");
        startPolling(data.jobId);
      } catch (e) {
        setResult({ error: errorMessage(e) });
        setStep("failed");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const startSync = useCallback(
    ({ bank, rut, password, ...range }: { bank: string; rut: string; password: string; fromDate?: string; toDate?: string }) =>
      start({ action: "start", bank, rut, password }, range),
    [start],
  );

  const startSyncStored = useCallback(
    ({ bank, ...range }: { bank: string; fromDate?: string; toDate?: string }) =>
      start({ action: "start-stored", bank }, range),
    [start],
  );

  const importSkipped = useCallback(
    async (movements: SyncMovementItem[], bank?: string): Promise<number> => {
      try {
        const { data, error } = await supabase.functions.invoke("bank-sync", {
          body: { action: "import-skipped", movements, ...(bank ? { bank } : {}) },
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

export function useBankSyncContext() {
  const ctx = useContext(BankSyncContext);
  if (!ctx) throw new Error("useBankSyncContext must be used inside BankSyncProvider");
  return ctx;
}
