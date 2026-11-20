import { useEffect, useRef } from "react";
import type { Transaction } from "@/hooks/useTransactions";
import { flashRows } from "@/hooks/useRowFlash";

export function useFlashRecategorized(transactions: Transaction[]) {
  const previous = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = new Map(transactions.map((t) => [t.id, t.category_name]));
    if (!before) return;
    flashRows(transactions.filter((t) => before.has(t.id) && before.get(t.id) !== t.category_name).map((t) => t.id));
  }, [transactions]);
}
