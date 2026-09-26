import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
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

/** 1500000 → "1.500.000": el monto se lee mientras se escribe. */
const groupDigits = (digits: string) => (digits ? Number(digits).toLocaleString("es-CL") : "");

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
  // Cuántos dígitos quedan a la izquierda del cursor: al agregar puntos el
  // texto cambia de largo, pero el cursor sigue detrás del mismo dígito.
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
        <span className="m inicio-amount-edit" style={{ color: amountColor }}>
          <span aria-hidden="true">{sign}$</span>
          {/* El campo mide lo que su texto: una copia invisible le da el ancho */}
          <span className="inicio-autosize" data-value={groupDigits(draft) || "0"}>
            <input
              ref={inputRef}
              className="inicio-edit amount"
              size={1}
              value={groupDigits(draft)}
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
