import { useState, type HTMLAttributes, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickCategoryPicker, type QuickCategoryOption } from "@/components/categories/QuickCategoryPicker";
import { InlineAmount, InlineText } from "@/components/transactions/InlineTxField";
import { cn } from "@/lib/utils";

interface Props extends HTMLAttributes<HTMLDivElement> {
  detail: string;
  amount: number;
  signOf: (amount: number) => string;
  amountColor?: string;
  icon: ReactNode;
  meta: ReactNode;
  category?: string;
  categoryOptions: QuickCategoryOption[];
  editable: boolean;
  privacy: boolean;
  onSave: (changes: { detail?: string; amount?: number; category_name?: string }) => void;
  onDelete: () => void;
}

export function InicioTxRow({
  detail, amount, signOf, amountColor, icon, meta, category, categoryOptions, editable, privacy,
  onSave, onDelete, className, ...rest
}: Props) {
  const [editingDetail, setEditingDetail] = useState(false);
  const [editingAmount, setEditingAmount] = useState(false);
  const [picking, setPicking] = useState(false);

  return (
    <div className={cn("inicio-tx", editable && "is-editable", (editingDetail || editingAmount || picking) && "is-editing", className)} {...rest}>
      {category && editable ? (
        <QuickCategoryPicker
          value={category}
          options={categoryOptions}
          title={detail}
          onOpenChange={setPicking}
          onPick={(name) => onSave({ category_name: name })}
        >
          <button className="flex-none rounded-full" aria-label={`Cambiar categoría (${category})`}>
            {icon}
          </button>
        </QuickCategoryPicker>
      ) : (
        icon
      )}
      <div className={cn("body", privacy && "privacy-blur")}>
        <InlineText
          className="d"
          value={detail}
          editable={editable}
          label="Detalle del movimiento"
          onSave={(value) => onSave({ detail: value })}
          onEditingChange={setEditingDetail}
        />
        <div className="c">
          {category}
          {meta}
        </div>
      </div>
      <InlineAmount
        className={cn("m", privacy && "privacy-blur")}
        amount={amount}
        signOf={signOf}
        color={amountColor}
        editable={editable}
        onSave={(value) => onSave({ amount: value })}
        onEditingChange={setEditingAmount}
      />
      {editable && (
        <Button
          variant="ghost"
          size="icon"
          className="inicio-delete size-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Borrar movimiento"
          onPointerDown={(e) => e.preventDefault()}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      )}
    </div>
  );
}
