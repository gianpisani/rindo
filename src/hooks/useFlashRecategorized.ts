import { useEffect, useRef, useState } from "react";
import type { Transaction } from "@/hooks/useTransactions";

const HIGHLIGHT_MS = 1000;

export function useRecategorizedIds(transactions: Transaction[]) {
  const previous = useRef<Map<string, string> | null>(null);
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const before = previous.current;
    previous.current = new Map(transactions.map((t) => [t.id, t.category_name]));
    if (!before) return;
    const changed = transactions.filter((t) => before.has(t.id) && before.get(t.id) !== t.category_name).map((t) => t.id);
    if (changed.length === 0) return;
    setIds((prev) => new Set([...prev, ...changed]));
    window.setTimeout(() => setIds((prev) => new Set([...prev].filter((id) => !changed.includes(id)))), HIGHLIGHT_MS);
  }, [transactions]);

  return ids;
}
