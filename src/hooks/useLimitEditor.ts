import { useState } from "react";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { useCategoryOptions } from "@/hooks/useCategoryOptions";
import { DEFAULT_ALERT_AT } from "@/lib/category-spending";
import { isCardPaymentCategory } from "@/lib/ledger";
import { parseAmount } from "@/lib/format";

export function useLimitEditor() {
  const { limits, upsertLimit, deleteLimit } = useCategoryLimits();
  const categoryOptions = useCategoryOptions();

  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [limitDraft, setLimitDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addCat, setAddCat] = useState("");
  const [addDraft, setAddDraft] = useState("");

  const limited = new Set(limits.map((l) => l.category_name));
  const addable = categoryOptions("Gasto").filter((c) => !limited.has(c.name) && !isCardPaymentCategory(c.name));

  const startEdit = (category: string, limit: number) => {
    setAdding(false);
    setEditingCat(category);
    setLimitDraft(String(limit));
  };
  const saveEdit = () => {
    const value = parseAmount(limitDraft);
    const existing = limits.find((l) => l.category_name === editingCat);
    if (!editingCat || value <= 0) return;
    upsertLimit.mutate({
      category_name: editingCat,
      monthly_limit: value,
      alert_at_percentage: existing?.alert_at_percentage ?? DEFAULT_ALERT_AT,
    });
    setEditingCat(null);
  };
  const remove = (category: string) => {
    const existing = limits.find((l) => l.category_name === category);
    if (existing) deleteLimit.mutate(existing.id);
    setEditingCat(null);
  };
  const startAdd = () => {
    setEditingCat(null);
    setAdding(true);
    setAddCat("");
    setAddDraft("");
  };
  const saveAdd = () => {
    const value = parseAmount(addDraft);
    if (!addCat || value <= 0) return;
    upsertLimit.mutate({ category_name: addCat, monthly_limit: value, alert_at_percentage: DEFAULT_ALERT_AT });
    setAdding(false);
  };

  return {
    edit: {
      category: editingCat,
      draft: limitDraft,
      setDraft: setLimitDraft,
      canSave: parseAmount(limitDraft) > 0,
      start: startEdit,
      save: saveEdit,
      cancel: () => setEditingCat(null),
      remove,
    },
    add: {
      active: adding,
      options: addable,
      category: addCat,
      setCategory: setAddCat,
      draft: addDraft,
      setDraft: setAddDraft,
      canSave: !!addCat && parseAmount(addDraft) > 0,
      start: startAdd,
      save: saveAdd,
      cancel: () => setAdding(false),
    },
  };
}

export type LimitEditor = ReturnType<typeof useLimitEditor>;
