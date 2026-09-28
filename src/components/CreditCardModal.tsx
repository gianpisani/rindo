import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUp, X } from "lucide-react";
import { parseWhisper } from "@/lib/whisper";
import type { CreditCard } from "@/hooks/useCreditCards";
import { cn } from "@/lib/utils";
import "./whisper.css";

/**
 * Nueva tarjeta al estilo Whisper: una línea con el cupo y el nombre
 * ("3000000 Banco de Chile"), el color en bolitas y tres campos chicos para
 * el cierre, el pago y los últimos dígitos. El composer toma el color de la
 * tarjeta a medida que lo eliges.
 */

interface CreditCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: CreditCard | null;
  onSave: (card: Omit<CreditCard, "id" | "user_id" | "created_at" | "updated_at">) => Promise<void>;
}

const CARD_COLORS = [
  "#6366f1", // indigo
  "#818cf8", // indigo-light
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#1e293b", // slate
  "#000000", // black
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v);

const dayOf = (raw: string, fallback: number) => {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? Math.min(31, Math.max(1, n)) : fallback;
};

export function CreditCardModal({ open, onOpenChange, card, onSave }: CreditCardModalProps) {
  const [value, setValue] = useState("");
  const [billingDay, setBillingDay] = useState("25");
  const [paymentDay, setPaymentDay] = useState("5");
  const [color, setColor] = useState(CARD_COLORS[0]);
  const [lastFour, setLastFour] = useState("");
  const [error, setError] = useState("");
  const saving = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!card;
  const parsed = parseWhisper(value);
  const name = parsed?.detail ?? "";
  const ready = !!parsed && name.length > 0;

  useEffect(() => {
    if (!open) return;
    if (card) {
      setValue(`${card.credit_limit} ${card.name}`);
      setBillingDay(String(card.billing_day));
      setPaymentDay(String(card.payment_day));
      setColor(card.color || CARD_COLORS[0]);
      setLastFour(card.last_4_digits || "");
    } else {
      setValue("");
      setBillingDay("25");
      setPaymentDay("5");
      setColor(CARD_COLORS[0]);
      setLastFour("");
    }
    setError("");
  }, [card, open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving.current) return;
    if (!parsed) {
      setError("Escribe el cupo en pesos, seguido del nombre de la tarjeta.");
      inputRef.current?.focus();
      return;
    }
    if (!name) {
      setError("Ponle un nombre a la tarjeta después del cupo.");
      inputRef.current?.focus();
      return;
    }
    saving.current = true;
    try {
      await onSave({
        name,
        credit_limit: parsed.amount,
        billing_day: dayOf(billingDay, 25),
        payment_day: dayOf(paymentDay, 5),
        color,
        last_4_digits: lastFour || null,
        is_active: true,
      });
      onOpenChange(false);
    } catch {
      setError("No se guardó la tarjeta. Intenta de nuevo.");
    } finally {
      saving.current = false;
    }
  };

  // El accent es el color de la tarjeta; el negro no se ve sobre negro.
  const accent = color === "#000000" ? "#fafafa" : color;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="whisper-backdrop" />
        <Dialog.Content
          data-scrollable
          className="whisper-composer"
          style={{ "--whisper-accent": accent } as React.CSSProperties}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">{isEditing ? "Editar tarjeta" : "Nueva tarjeta"}</Dialog.Title>
          <Dialog.Description className="sr-only">
            Escribe el cupo y el nombre en una línea. Abajo eliges el color, el día de cierre, el día de pago y los últimos dígitos.
          </Dialog.Description>
          <Dialog.Close className="whisper-close" aria-label="Cerrar">
            <X size={16} />
          </Dialog.Close>

          <form onSubmit={submit} className="whisper-form">
            <div className="whisper-type" data-static>
              <span className="whisper-dot" aria-hidden="true" />
              <span>{isEditing ? "Editar tarjeta" : "Tarjeta"}</span>
            </div>

            <div className="whisper-entry">
              <input
                ref={inputRef}
                aria-label="Cupo y nombre de la tarjeta"
                aria-describedby={error ? "card-error card-shortcuts" : "card-shortcuts"}
                aria-invalid={!!error}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={120}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError("");
                }}
                placeholder="3000000 Banco de Chile"
                className="whisper-input"
              />
              <div className="whisper-preview" aria-hidden="true">
                {parsed && <span>cupo {formatCurrency(parsed.amount)}</span>}
              </div>
            </div>

            <div className="whisper-category-space">
              <div className="whisper-swatches" role="radiogroup" aria-label="Color de la tarjeta">
                {CARD_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={`Color ${c}`}
                    className="whisper-swatch"
                    style={{ "--swatch": c } as React.CSSProperties}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
              <p className="whisper-caption" aria-live="polite">
                {name ? `${name}${lastFour ? ` ···· ${lastFour}` : ""}` : "El nombre va después del cupo"} · cierra el {dayOf(billingDay, 25)} · se paga el{" "}
                {dayOf(paymentDay, 5)}
              </p>
            </div>

            <div className="whisper-options whisper-options-3">
              <label>
                Cierre (día)
                <input type="number" inputMode="numeric" min={1} max={31} value={billingDay} onChange={(e) => setBillingDay(e.target.value)} aria-label="Día de cierre" />
              </label>
              <label>
                Pago (día)
                <input type="number" inputMode="numeric" min={1} max={31} value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} aria-label="Día de pago" />
              </label>
              <label>
                Últimos 4
                <input
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="····"
                  value={lastFour}
                  onChange={(e) => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  aria-label="Últimos cuatro dígitos"
                />
              </label>
            </div>

            {error && (
              <p id="card-error" role="alert" className="whisper-error">
                {error}
              </p>
            )}

            <div className="whisper-actions">
              <button type="submit" className="whisper-submit" disabled={!ready} aria-label="Guardar tarjeta">
                {isEditing ? "Guardar cambios" : "Agregar tarjeta"}
                <span className="hidden sm:inline" aria-hidden="true">↵</span>
                <ArrowUp size={14} className={cn("sm:hidden")} aria-hidden="true" />
              </button>
            </div>
            <p id="card-shortcuts" className="whisper-shortcuts">
              <span>
                <kbd>↵</kbd> guardar
              </span>
              <span>
                <kbd>Esc</kbd> cerrar
              </span>
            </p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
