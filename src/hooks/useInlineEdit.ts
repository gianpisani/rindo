import { useCallback, useState } from "react";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryOptions } from "@/hooks/useCategoryOptions";

export type InlineChanges = Partial<Pick<Transaction, "detail" | "amount" | "category_name">>;

const RECATEGORIZED_HIGHLIGHT_MS = 1000;
const ROW_EXIT_MS = 260;

const without = (set: ReadonlySet<string>, id: string) => new Set([...set].filter((item) => item !== id));

export function useInlineEdit() {
  const { updateTransaction, deleteTransactions } = useTransactions();
  const categoryOptions = useCategoryOptions();
  const { emojiOf, colorOf } = useCategories();
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

  return { save, remove, changed, leaving, categoryOptions, emojiOf, colorOf };
}

export type InlineEdit = ReturnType<typeof useInlineEdit>;
