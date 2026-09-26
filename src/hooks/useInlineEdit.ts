import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { categoryFrequency } from "@/lib/whisper";
import { getCategoryIcon } from "@/components/TransactionsTable";
import { ANALYZING_CATEGORY } from "@/lib/auto-category-policy";
import type { TransactionType } from "@/lib/ledger";
import type { InicioCategoryOption } from "@/components/InicioTxRow";

export type InlineChanges = Partial<Pick<Transaction, "detail" | "amount" | "category_name">>;

/**
 * Editar y borrar un movimiento donde se ve (Recientes del inicio, los
 * paneles de Finanzas). Optimista: el cambio se ve al soltar el campo y la
 * red va detrás; si falla, vuelve a como estaba. Borrar pliega la fila
 * primero y el toast trae "Deshacer".
 */
export function useInlineEdit() {
  const queryClient = useQueryClient();
  const { transactions, updateTransactionSilent, deleteTransaction } = useTransactions();
  const { categories } = useCategories();
  // Filas recién recategorizadas (el ícono rebota) y las que se están yendo.
  const [changed, setChanged] = useState<ReadonlySet<string>>(new Set());
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());

  const save = useCallback((t: Transaction, changes: InlineChanges) => {
    const previous = queryClient.getQueryData<Transaction[]>(["transactions"]);
    queryClient.setQueryData<Transaction[]>(["transactions"], (list) =>
      list?.map((row) => (row.id === t.id ? { ...row, ...changes } : row)));
    if (changes.category_name) {
      setChanged((prev) => new Set(prev).add(t.id));
      window.setTimeout(() => setChanged((prev) => new Set([...prev].filter((id) => id !== t.id))), 1000);
    }
    updateTransactionSilent.mutate({ id: t.id, ...changes }, {
      onError: () => queryClient.setQueryData(["transactions"], previous),
    });
  }, [queryClient, updateTransactionSilent]);

  const remove = useCallback((t: Transaction) => {
    setLeaving((prev) => new Set(prev).add(t.id));
    window.setTimeout(() => {
      const previous = queryClient.getQueryData<Transaction[]>(["transactions"]);
      deleteTransaction.mutate(t.id, {
        onError: (error) => {
          queryClient.setQueryData(["transactions"], previous);
          setLeaving((prev) => new Set([...prev].filter((id) => id !== t.id)));
          toast.error(error instanceof Error ? error.message : "No se pudo borrar");
        },
      });
      // Después de mutate: el hook ya tomó la fila para poder deshacer.
      queryClient.setQueryData<Transaction[]>(["transactions"], (list) => list?.filter((row) => row.id !== t.id));
    }, 260);
  }, [queryClient, deleteTransaction]);

  // Las categorías del mismo tipo, las más usadas primero.
  const optionsByType = useMemo(() => {
    const map = new Map<string, InicioCategoryOption[]>();
    for (const type of new Set(categories.map((c) => c.type))) {
      const frequency = categoryFrequency(transactions, type);
      map.set(type, categories
        .filter((c) => c.type === type && c.is_active !== false && !["Sin categoría", ANALYZING_CATEGORY].includes(c.name))
        .sort((a, b) => (frequency.get(b.name) ?? 0) - (frequency.get(a.name) ?? 0) || a.name.localeCompare(b.name))
        .map((c) => ({ name: c.name, icon: c.icon || getCategoryIcon(c.name), color: c.color })));
    }
    return map;
  }, [categories, transactions]);

  const categoryOptions = useCallback((type: TransactionType) => optionsByType.get(type) ?? [], [optionsByType]);
  const emojiOf = useCallback((name: string) => categories.find((c) => c.name === name)?.icon || getCategoryIcon(name), [categories]);
  const colorOf = useCallback((name: string) => categories.find((c) => c.name === name)?.color ?? null, [categories]);

  return { save, remove, changed, leaving, categoryOptions, emojiOf, colorOf };
}

export type InlineEdit = ReturnType<typeof useInlineEdit>;
