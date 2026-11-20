import { useCallback, useMemo, useState } from "react";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { categoryFrequency } from "@/lib/whisper";
import { getCategoryIcon } from "@/lib/category-icon";
import { ANALYZING_CATEGORY } from "@/lib/auto-category-policy";
import type { TransactionType } from "@/lib/ledger";
import type { QuickCategoryOption } from "@/components/QuickCategoryPicker";

export type InlineChanges = Partial<Pick<Transaction, "detail" | "amount" | "category_name">>;

const RECATEGORIZED_HIGHLIGHT_MS = 1000;
const ROW_EXIT_MS = 260;

const without = (set: ReadonlySet<string>, id: string) => new Set([...set].filter((item) => item !== id));

export function useInlineEdit() {
  const { transactions, updateTransaction, deleteTransactions } = useTransactions();
  const { categories } = useCategories();
  const [changed, setChanged] = useState<ReadonlySet<string>>(new Set());
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());

  const save = useCallback((t: Transaction, changes: InlineChanges) => {
    if (changes.category_name) {
      setChanged((prev) => new Set(prev).add(t.id));
      window.setTimeout(() => setChanged((prev) => without(prev, t.id)), RECATEGORIZED_HIGHLIGHT_MS);
    }
    updateTransaction.mutate({ id: t.id, ...changes });
  }, [updateTransaction]);

  const remove = useCallback((t: Transaction) => {
    setLeaving((prev) => new Set(prev).add(t.id));
    window.setTimeout(() => {
      deleteTransactions.mutate([t.id], {
        onSettled: () => setLeaving((prev) => without(prev, t.id)),
      });
    }, ROW_EXIT_MS);
  }, [deleteTransactions]);

  const optionsByType = useMemo(() => {
    const map = new Map<string, QuickCategoryOption[]>();
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
