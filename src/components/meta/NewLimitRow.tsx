import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickCategoryPicker } from "@/components/categories/QuickCategoryPicker";
import { AmountField } from "@/components/meta/AmountField";
import type { LimitEditor } from "@/hooks/useLimitEditor";
import { cn } from "@/lib/utils";

export function NewLimitRow({ add }: { add: LimitEditor["add"] }) {
  const picked = add.options.find((c) => c.name === add.category);

  return (
    <div className="meta-lim-add">
      <QuickCategoryPicker value={add.category} options={add.options} title="Categoría del límite" onPick={add.setCategory}>
        <button
          type="button"
          className={cn(
            "meta-lim-select flex h-10 w-full items-center justify-between rounded-card border border-input bg-background px-3 text-sm",
            !picked && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {picked ? (
              <>
                <span className="mr-1.5">{picked.icon}</span>
                {picked.name}
              </>
            ) : (
              "Categoría"
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </QuickCategoryPicker>
      <AmountField
        value={add.draft}
        onChange={add.setDraft}
        onSave={add.save}
        onCancel={add.cancel}
        placeholder="100.000"
        label="Límite mensual"
      />
      <Button variant="ghost" size="icon" className="size-9" onClick={add.save} disabled={!add.canSave} aria-label="Guardar límite">
        <Check />
      </Button>
      <Button variant="ghost" size="icon" className="size-9" onClick={add.cancel} aria-label="Cancelar">
        <X />
      </Button>
    </div>
  );
}
