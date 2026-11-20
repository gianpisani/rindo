import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AmountField } from "@/components/meta/AmountField";
import type { GoalDraft } from "@/hooks/useGoalDraft";

export function GoalInput({ goal, autoFocus, cancellable }: { goal: GoalDraft; autoFocus: boolean; cancellable: boolean }) {
  return (
    <span className="meta-edit">
      <AmountField
        value={goal.draft}
        onChange={goal.setDraft}
        onSave={goal.save}
        onCancel={goal.cancel}
        autoFocus={autoFocus}
        label="Meta de ahorro mensual"
      />
      <Button variant="ghost" size="icon" className="size-9" onClick={goal.save} disabled={!goal.canSave} aria-label="Guardar meta">
        <Check />
      </Button>
      {cancellable && (
        <Button variant="ghost" size="icon" className="size-9" onClick={goal.cancel} aria-label="Cancelar">
          <X />
        </Button>
      )}
    </span>
  );
}
