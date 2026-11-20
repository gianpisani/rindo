import { useCallback, useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { categoryFrequency } from "@/lib/whisper";
import { getCategoryIcon } from "@/lib/category-icon";
import { ANALYZING_CATEGORY } from "@/lib/auto-category-policy";
import type { CategoryOption } from "@/lib/category-options";
import type { TransactionType } from "@/lib/ledger";

const HIDDEN_CATEGORIES = ["Sin categoría", ANALYZING_CATEGORY];

export function useCategoryOptions() {
  const { transactions } = useTransactions();
  const { categories } = useCategories();

  const optionsByType = useMemo(() => {
    const map = new Map<string, CategoryOption[]>();
    for (const type of new Set(categories.map((c) => c.type))) {
      const frequency = categoryFrequency(transactions, type);
      map.set(type, categories
        .filter((c) => c.type === type && c.is_active !== false && c.name.trim().length > 0 && !HIDDEN_CATEGORIES.includes(c.name))
        .sort((a, b) => (frequency.get(b.name) ?? 0) - (frequency.get(a.name) ?? 0) || a.name.localeCompare(b.name))
        .map((c) => ({ name: c.name, icon: c.icon || getCategoryIcon(c.name), color: c.color })));
    }
    return map;
  }, [categories, transactions]);

  return useCallback((type: TransactionType) => optionsByType.get(type) ?? [], [optionsByType]);
}
