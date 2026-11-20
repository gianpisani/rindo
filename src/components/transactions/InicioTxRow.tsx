import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickCategoryPicker, type QuickCategoryOption } from "@/components/categories/QuickCategoryPicker";
import { cn } from "@/lib/utils";
import { formatAmountInput } from "@/lib/format";

interface Props extends HTMLAttributes<HTMLDivElement> {
  detail: string;
  amount: number;
  sign: string;
  amountColor?: string;
  icon: ReactNode;
  meta: ReactNode;
  category?: string;
  categoryOptions: QuickCategoryOption[];
  editable: boolean;
  privacy: boolean;
  formatAmount: (value: number) => string;
  onSave: (changes: { detail?: string; amount?: number; category_name?: string }) => void;
  onDelete: () => void;
}

type Field = "detail" | "amount" | null;

export function InicioTxRow({
  detail, amount, sign, amountColor, icon, meta, category, categoryOptions, editable, privacy,
  formatAmount, onSave, onDelete, className, ...rest
}: Props) {
  const [field, setField] = useState<Field>(null);
  const [draft, setDraft] = useState("");
  const [picking, setPicking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  const caretDigits = useRef<number | null>(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (field !== "amount" || !input || caretDigits.current === null) return;
    let seen = 0;
    let position = 0;
    while (position < input.value.length && seen < caretDigits.current) {
      if (/\d/.test(input.value[position])) seen++;
      position++;
    }
    input.setSelectionRange(position, position);
    caretDigits.current = null;
  }, [draft, field]);

  const onAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { value, selectionStart } = e.target;
    caretDigits.current = value.slice(0, selectionStart ?? value.length).replace(/\D/g, "").length;
    setDraft(value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12));
  };

  useEffect(() => {
    if (field) inputRef.current?.select();
  }, [field]);

  const open = (next: Exclude<Field, null>) => {
    if (!editable) return;
    cancelled.current = false;
    setDraft(next === "detail" ? detail : String(amount));
    setField(next);
  };

  const commit = () => {
    if (cancelled.current || !field) return setField(null);
    if (field === "detail") {
      const value = draft.trim();
      if (value !== detail) onSave({ detail: value });
    } else {
      const value = Number(draft);
      if (Number.isSafeInteger(value) && value > 0 && value !== amount) onSave({ amount: value });
    }
    setField(null);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") {
      cancelled.current = true;
      e.currentTarget.blur();
    }
  };

  return (
    <div className={cn("inicio-tx", editable && "is-editable", (field || picking) && "is-editing", className)} {...rest}>
      {category && editable ? (
        <QuickCategoryPicker
          value={category}
          options={categoryOptions}
          title={detail}
          onOpenChange={setPicking}
          onPick={(name) => onSave({ category_name: name })}
        >
          <button className="flex-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Cambiar categoría (${category})`}>
            {icon}
          </button>
        </QuickCategoryPicker>
      ) : (
        icon
      )}
      <div className={cn("body", privacy && "privacy-blur")}>
        {field === "detail" ? (
          <input
            ref={inputRef}
            className="inicio-edit d"
            value={draft}
            placeholder="Sin detalle"
            aria-label="Detalle del movimiento"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={commit}
          />
        ) : (
          <button className="d inicio-editable" disabled={!editable} onClick={() => open("detail")} aria-label="Editar detalle">
            {detail || <span className="inicio-placeholder">Sin detalle</span>}
          </button>
        )}
        <div className="c">
          {category}
          {meta}
        </div>
      </div>
      {field === "amount" ? (
        <span className="m inicio-amount-edit" style={{ color: amountColor }}>
          <span aria-hidden="true">{sign}$</span>
          <span className="inicio-autosize" data-value={formatAmountInput(draft) || "0"}>
            <input
              ref={inputRef}
              className="inicio-edit amount"
              size={1}
              value={formatAmountInput(draft)}
              inputMode="numeric"
              aria-label="Monto del movimiento"
              onChange={onAmountChange}
              onKeyDown={onKey}
              onBlur={commit}
            />
          </span>
        </span>
      ) : (
        <button
          className={cn("m inicio-editable", privacy && "privacy-blur")}
          style={{ color: amountColor }}
          disabled={!editable}
          onClick={() => open("amount")}
          aria-label="Editar monto"
        >
          {sign}{formatAmount(amount)}
        </button>
      )}
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
