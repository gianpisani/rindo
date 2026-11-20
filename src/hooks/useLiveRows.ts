import { useCallback, useEffect, useRef, useState } from "react";

export interface LiveRow {
  id: string;
  type: string;
  amount: number;
  detail: string | null;
  created_at: string;
  isPending?: boolean;
}

const ENTER_MS = 1800;
const RESOLVE_MS = 1000;
const RECENT_MS = 60_000;

const signatureOf = (row: LiveRow) => `${row.type}|${Number(row.amount)}|${row.detail ?? ""}`;

export function useLiveRows<T extends LiveRow>(rows: T[], ready: boolean, isAnalyzing: (row: T) => boolean) {
  const seen = useRef<Set<string> | null>(null);
  const wasAnalyzing = useRef(new Map<string, boolean>());
  const pendingBySignature = useRef(new Map<string, { key: string; at: number }>());
  const inherited = useRef(new Map<string, string>());
  const timers = useRef<number[]>([]);
  const [entered, setEntered] = useState<ReadonlySet<string>>(new Set());
  const [resolved, setResolved] = useState<ReadonlySet<string>>(new Set());

  const pendingSignatures = new Set(rows.filter((r) => r.isPending).map(signatureOf));
  const visible = rows.filter((r) => r.isPending || !pendingSignatures.has(signatureOf(r)));

  const keyOf = useCallback((row: T) => {
    if (row.isPending) return row.id;
    const known = inherited.current.get(row.id);
    if (known) return known;
    const twin = pendingBySignature.current.get(signatureOf(row));
    if (twin && Date.now() - twin.at < RECENT_MS && !seen.current?.has(row.id)) return twin.key;
    return row.id;
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!seen.current) {
      seen.current = new Set(visible.map((r) => r.id));
      visible.forEach((r) => wasAnalyzing.current.set(r.id, isAnalyzing(r)));
      return;
    }
    const now = Date.now();
    const newlyEntered: string[] = [];
    const newlyResolved: string[] = [];
    for (const row of visible) {
      const key = keyOf(row);
      if (!row.isPending && key !== row.id) {
        inherited.current.set(row.id, key);
        pendingBySignature.current.delete(signatureOf(row));
      }
      if (!seen.current.has(row.id)) {
        seen.current.add(row.id);
        if (row.isPending) {
          pendingBySignature.current.set(signatureOf(row), { key, at: now });
          newlyEntered.push(key);
        } else if (key === row.id && now - new Date(row.created_at).getTime() < RECENT_MS) {
          newlyEntered.push(key);
        }
      }
      const analyzing = isAnalyzing(row);
      if (wasAnalyzing.current.get(row.id) && !analyzing) newlyResolved.push(key);
      wasAnalyzing.current.set(row.id, analyzing);
    }
    const flash = (keys: string[], set: typeof setEntered, ms: number) => {
      if (!keys.length) return;
      set((prev) => new Set([...prev, ...keys]));
      timers.current.push(window.setTimeout(() => {
        set((prev) => new Set([...prev].filter((k) => !keys.includes(k))));
      }, ms));
    };
    flash(newlyEntered, setEntered, ENTER_MS);
    flash(newlyResolved, setResolved, RESOLVE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ready]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return { visible, keyOf, entered, resolved };
}
