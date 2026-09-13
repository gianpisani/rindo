import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Transaction } from "./useTransactions";
import { boardSchema, factory, type Board } from "@/lib/graficos/model";

// Only chart configuration is cached; movements keep their existing data source.
export function useGraficos(userId: string) {
  const key = `rindo-graficos-v1:${userId}`;
  const readLocal = () => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  };
  const [board, setBoard] = useState<Board>(() => {
    const parsed = boardSchema.safeParse(readLocal());
    return parsed.success ? (parsed.data as Board) : factory();
  });
  const [status, setStatus] = useState("Guardado en este dispositivo");
  const [canSync, setCanSync] = useState(false);
  const [conflict, setConflict] = useState(false);
  const latest = useRef(board);
  const revision = useRef(board.revision);
  const saving = useRef(false);
  const cache = (next: Board, localDirty: boolean) => {
    try {
      localStorage.setItem(key, JSON.stringify({ ...next, localDirty }));
      return true;
    } catch {
      return false;
    }
  };
  useEffect(() => {
    let active = true;
    supabase.rpc("read_analysis_board").then(({ data, error }) => {
      if (!active || error) return;
      const remote = boardSchema.safeParse(data);
      const local = readLocal();
      if (remote.success && (!local || local.localDirty === false)) {
        const next = remote.data as Board;
        latest.current = next;
        revision.current = next.revision;
        setBoard(next);
        cache(next, false);
        setStatus("Guardado en tu cuenta");
      } else if (remote.success && remote.data.revision !== revision.current) {
        setConflict(true);
        setStatus(
          "Hay otra versión en tu cuenta. Tu copia local está conservada.",
        );
      }
      setCanSync(true);
    });
    return () => {
      active = false;
    };
    // This hook is keyed by authenticated user in PersonalBoard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const change = (next: Board) => {
    latest.current = next;
    setBoard(next);
    setStatus(
      cache(next, true)
        ? "Guardado en este dispositivo"
        : "No se pudo guardar. Mantén esta pestaña abierta.",
    );
  };
  const sync = async () => {
    if (saving.current) return;
    saving.current = true;
    setStatus("Guardando en tu cuenta…");
    const snapshot = latest.current;
    try {
      const { data, error } = await supabase.rpc("save_analysis_board", {
        payload: JSON.parse(JSON.stringify(snapshot)),
        expected_revision: revision.current,
      });
      if (error) {
        setConflict(error.message.includes("conflict"));
        setStatus(
          error.message.includes("conflict")
            ? "Hay otra versión en tu cuenta. Tu copia local está conservada."
            : "No se pudo sincronizar. Tu copia local sigue disponible.",
        );
        return;
      }
      const moreEdits = snapshot !== latest.current;
      const next = { ...latest.current, revision: Number(data) };
      revision.current = next.revision;
      latest.current = next;
      setBoard(next);
      cache(next, moreEdits);
      setConflict(false);
      setStatus(
        moreEdits
          ? "Tus últimos cambios están guardados solo en este dispositivo"
          : "Guardado en tu cuenta",
      );
    } catch {
      setStatus("No se pudo sincronizar. Tu copia local sigue disponible.");
    } finally {
      saving.current = false;
    }
  };
  const loadAccount = async () => {
    const { data, error } = await supabase.rpc("read_analysis_board");
    const parsed = boardSchema.safeParse(data);
    if (error || !parsed.success) {
      setStatus("No se pudo cargar la versión de tu cuenta.");
      return;
    }
    // Keep the replaced configuration recoverable, even across a reload.
    try {
      localStorage.setItem(`${key}:backup`, JSON.stringify(latest.current));
    } catch {
      setStatus("No se pudo respaldar tu copia local. No la reemplazamos.");
      return;
    }
    const next = parsed.data as Board;
    revision.current = next.revision;
    latest.current = next;
    setBoard(next);
    cache(next, false);
    setConflict(false);
    setStatus(
      "Versión de tu cuenta cargada. Copia anterior respaldada en este dispositivo.",
    );
  };
  return { board, change, status, canSync, sync, conflict, loadAccount };
}

export function useChartTransactions(userId: string) {
  return useQuery({
    queryKey: ["transactions", "graficos", userId],
    queryFn: async () => {
      const all: Transaction[] = [];
      // Supabase caps result pages. Fetch the complete history, with a stable tie-breaker.
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", userId)
          .order("date")
          .order("id")
          .range(offset, offset + 999);
        if (error) throw error;
        all.push(...(data as Transaction[]));
        if (data.length < 1000) break;
      }
      return all;
    },
    staleTime: 30_000,
  });
}
