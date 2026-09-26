import { useEffect, useRef, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Una fila de Recientes que se edita donde está: solo lo que ya se ve.
 * Detalle y monto se vuelven un campo con la misma tipografía (Enter o
 * salir guarda, Esc cancela); la categoría abre un selector chico; el
 * basurero aparece al pasar el mouse (en táctil, mientras editas la fila).
 * Quien la usa decide cómo guardar: acá no hay red, solo la interacción.
 */
export interface InicioCategoryOption {
  name: string;
  icon: string;
  color?: string | null;
}

interface Props extends HTMLAttributes<HTMLDivElement> {
  detail: string;
  amount: number;
  sign: string;
  amountColor?: string;
  icon: ReactNode;
  meta: ReactNode;
  /** Categoría actual; sin ella (reembolsos, pendientes) no se ofrece cambiarla. */
  category?: string;
  categoryOptions: InicioCategoryOption[];
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
  // Esc cancela; el blur que sigue no debe guardar lo descartado.
  const cancelled = useRef(false);

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
      const value = Number(draft.replace(/[^\d]/g, ""));
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
      {icon}
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
          {category && editable ? (
            <Popover open={picking} onOpenChange={setPicking}>
              <PopoverTrigger asChild>
                <button className="inicio-editable" aria-label="Cambiar categoría">{category}</button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="inicio-picker"
                // Se abre parado sobre la categoría actual, no sobre la primera.
                onOpenAutoFocus={(e) => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
                }}
              >
                {categoryOptions.map((option) => (
                  <button
                    key={option.name}
                    aria-pressed={option.name === category}
                    onClick={() => {
                      setPicking(false);
                      if (option.name !== category) onSave({ category_name: option.name });
                    }}
                  >
                    <span className="inicio-ico" style={{ background: `color-mix(in oklch, ${option.color || "var(--muted-foreground)"} 22%, transparent)` }}>
                      {option.icon}
                    </span>
                    {option.name}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          ) : null}
          {meta}
        </div>
      </div>
      {field === "amount" ? (
        <input
          ref={inputRef}
          className="inicio-edit m"
          value={draft}
          inputMode="numeric"
          aria-label="Monto del movimiento"
          style={{ width: `${Math.max(draft.length, 4) + 2}ch` }}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ""))}
          onKeyDown={onKey}
          onBlur={commit}
        />
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
        <button
          className="inicio-delete"
          aria-label="Borrar movimiento"
          // Que el blur del campo no se coma el toque: borrar gana.
          onPointerDown={(e) => e.preventDefault()}
          onClick={onDelete}
        >
          <Trash2 />
        </button>
      )}
    </div>
  );
}
