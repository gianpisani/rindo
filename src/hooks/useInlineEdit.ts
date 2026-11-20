import { useCallback, useState } from "react";
import type { Transaction } from "@/hooks/useTransactions";
import { useEditHistory } from "@/hooks/useEditHistory";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryOptions } from "@/hooks/useCategoryOptions";

export type InlineChanges = Partial<Pick<Transaction, "detail" | "amount" | "category_name">>;

const ROW_EXIT_MS = 260;

const without = (set: ReadonlySet<string>, id: string) => new Set([...set].filter((item) => item !== id));

export function useInlineEdit() {
  const history = useEditHistory();
  const categoryOptions = useCategoryOptions();
  const { emojiOf, colorOf } = useCategories();
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());

  const save = useCallback((t: Transaction, changes: InlineChanges) => {
    void history.update([t.id], changes);
  }, [history]);

  const remove = useCallback((t: Transaction) => {
    setLeaving((prev) => new Set(prev).add(t.id));
    window.setTimeout(() => {
      void history.remove([t.id]).finally(() => setLeaving((prev) => without(prev, t.id)));
    }, ROW_EXIT_MS);
  }, [history]);

  return { save, remove, leaving, categoryOptions, emojiOf, colorOf };
}

export type InlineEdit = ReturnType<typeof useInlineEdit>;
