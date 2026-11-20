import { useEffect, useState } from "react";
import { parseAmount } from "@/lib/format";

export function useGoalDraft(goal: number, hasGoal: boolean, saveGoal: (value: number) => void) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    if (!editing) setDraft(hasGoal ? String(goal) : "");
  }, [goal, hasGoal, editing]);

  const save = () => {
    const value = parseAmount(draft);
    if (value <= 0) return;
    saveGoal(value);
    setEditing(false);
  };

  return {
    editing,
    startEditing: () => setEditing(true),
    cancel: () => setEditing(false),
    draft,
    setDraft,
    save,
    canSave: parseAmount(draft) > 0,
  };
}

export type GoalDraft = ReturnType<typeof useGoalDraft>;
