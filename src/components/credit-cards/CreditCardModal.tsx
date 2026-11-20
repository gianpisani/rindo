import { useEffect, useRef, useState } from "react";
import { parseWhisper } from "@/lib/whisper";
import type { CreditCard } from "@/hooks/useCreditCards";
import { useComposerSubmit } from "@/hooks/useComposerSubmit";
import { WhisperComposer, WhisperShortcuts, WhisperStaticType, WhisperSubmit } from "@/components/shared/whisper/WhisperComposer";
import { clp } from "@/lib/format";

interface CreditCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: CreditCard | null;
  onSave: (card: Omit<CreditCard, "id" | "user_id" | "created_at" | "updated_at">) => Promise<void>;
}

const CARD_COLORS = [
  "#6366f1",
  "#818cf8",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#1e293b",
  "#000000",
];

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
  const { error, setError, guardedSubmit } = useComposerSubmit();
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
  }, [card, open, setError]);

  const submit = guardedSubmit(async () => {
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
  }, "No se guardó la tarjeta. Intenta de nuevo.");

  const accent = color === "#000000" ? "#fafafa" : color;

  return (
    <WhisperComposer
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar tarjeta" : "Nueva tarjeta"}
      description="Escribe el cupo y el nombre en una línea. Abajo eliges el color, el día de cierre, el día de pago y los últimos dígitos."
      accent={accent}
      focusOnOpen={() => inputRef.current?.focus()}
      onSubmit={submit}
    >
      <WhisperStaticType>{isEditing ? "Editar tarjeta" : "Tarjeta"}</WhisperStaticType>

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
          {parsed && <span>cupo {clp(parsed.amount)}</span>}
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
        <WhisperSubmit label="Guardar tarjeta" disabled={!ready}>
          {isEditing ? "Guardar cambios" : "Agregar tarjeta"}
        </WhisperSubmit>
      </div>
      <WhisperShortcuts id="card-shortcuts" items={[["↵", "guardar"], ["Esc", "cerrar"]]} />
    </WhisperComposer>
  );
}
