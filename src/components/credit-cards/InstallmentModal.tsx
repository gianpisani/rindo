import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { addMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import { parseWhisper } from "@/lib/whisper";
import { getCategoryIcon } from "@/lib/category-icon";
import type { InstallmentPurchase } from "@/hooks/useInstallments";
import type { CreditCard } from "@/hooks/useCreditCards";
import { useCategories } from "@/hooks/useCategories";
import { useSoundFX } from "@/hooks/useSoundFX";
import { useComposerSubmit } from "@/hooks/useComposerSubmit";
import { isCardPaymentCategory } from "@/lib/ledger";
import { WhisperComposer, WhisperShortcuts, WhisperStaticType, WhisperSubmit } from "@/components/shared/whisper/WhisperComposer";
import { WhisperOptions, WhisperOptionsToggle } from "@/components/shared/whisper/WhisperOptions";
import { clp } from "@/lib/format";

interface InstallmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment?: InstallmentPurchase | null;
  creditCards: CreditCard[];
  onSave: (
    purchase: Omit<InstallmentPurchase, "id" | "user_id" | "created_at" | "updated_at" | "card_name" | "card_color">
  ) => Promise<void>;
}

const INSTALLMENT_OPTIONS = [3, 6, 12, 18, 24, 36];
const DEFAULT_CATEGORY = "Otros gastos";
const FALLBACK_ACCENT = "#fafafa";

const isoDay = (d: Date) => format(d, "yyyy-MM-dd");
const monthOf = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isFinite(d.getTime()) ? format(d, "MMMM yyyy", { locale: es }) : "";
};

export function InstallmentModal({ open, onOpenChange, installment, creditCards, onSave }: InstallmentModalProps) {
  const { categories } = useCategories();
  const { playTap } = useSoundFX();
  const [value, setValue] = useState("");
  const [count, setCount] = useState(6);
  const [cardId, setCardId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(isoDay(new Date()));
  const [firstDate, setFirstDate] = useState(isoDay(addMonths(new Date(), 1)));
  const [categoryName, setCategoryName] = useState(DEFAULT_CATEGORY);
  const [notes, setNotes] = useState("");
  const [expanded, setExpanded] = useState(false);
  const { error, setError, guardedSubmit } = useComposerSubmit();
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!installment;
  const parsed = parseWhisper(value);
  const description = parsed?.detail ?? "";
  const installmentAmount = parsed ? Math.ceil(parsed.amount / count) : 0;
  const ready = !!parsed && description.length > 0 && !!cardId;
  const selectedCard = creditCards.find((c) => c.id === cardId);
  const expenseCategories = categories.filter((c) => c.type === "Gasto" && c.is_active !== false && !isCardPaymentCategory(c.name));
  const counts = INSTALLMENT_OPTIONS.includes(count) ? INSTALLMENT_OPTIONS : [...INSTALLMENT_OPTIONS, count].sort((a, b) => a - b);

  useEffect(() => {
    if (!open) return;
    if (installment) {
      setValue(`${installment.total_amount} ${installment.description}`);
      setCount(installment.total_installments);
      setCardId(installment.card_id);
      setPurchaseDate(installment.purchase_date.slice(0, 10));
      setFirstDate(installment.first_installment_date.slice(0, 10));
      setCategoryName(installment.category_name || DEFAULT_CATEGORY);
      setNotes(installment.notes || "");
    } else {
      setValue("");
      setCount(6);
      setCardId(creditCards[0]?.id || "");
      setPurchaseDate(isoDay(new Date()));
      setFirstDate(isoDay(addMonths(new Date(), 1)));
      setCategoryName(DEFAULT_CATEGORY);
      setNotes("");
    }
    setExpanded(false);
    setError("");
  }, [installment, open, creditCards, setError]);

  const submit = guardedSubmit(async () => {
    if (!parsed) {
      setError("Escribe el total en pesos, seguido de qué compraste.");
      inputRef.current?.focus();
      return;
    }
    if (!description) {
      setError("Cuenta qué compraste después del monto.");
      inputRef.current?.focus();
      return;
    }
    if (!cardId) {
      setError("Elige la tarjeta.");
      return;
    }
    if (!monthOf(purchaseDate) || !monthOf(firstDate)) {
      setExpanded(true);
      setError("Revisa las fechas.");
      return;
    }
    await onSave({
      card_id: cardId,
      description,
      total_amount: parsed.amount,
      total_installments: count,
      installment_amount: installmentAmount,
      paid_installments: installment?.paid_installments || 0,
      purchase_date: purchaseDate,
      first_installment_date: firstDate,
      category_name: categoryName,
      notes: notes || null,
      is_active: true,
    });
    onOpenChange(false);
  }, "No se guardó la compra. Intenta de nuevo.");

  const accent = selectedCard?.color && selectedCard.color !== "#000000" ? selectedCard.color : FALLBACK_ACCENT;

  return (
    <WhisperComposer
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar compra" : "Nueva compra en cuotas"}
      description="Escribe el total y qué compraste en una línea. Abajo eliges la tarjeta y la cantidad de cuotas. En más opciones están las fechas, la categoría y las notas."
      accent={accent}
      focusOnOpen={() => inputRef.current?.focus()}
      onSubmit={submit}
    >
      <WhisperStaticType>{isEditing ? "Editar compra" : "Compra en cuotas"}</WhisperStaticType>

      <div className="whisper-entry">
        <input
          ref={inputRef}
          aria-label="Total y qué compraste"
          aria-describedby={error ? "inst-error inst-shortcuts" : "inst-shortcuts"}
          aria-invalid={!!error}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={200}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
          placeholder="1498800 MacBook Air"
          className="whisper-input"
        />
        <div className="whisper-preview" aria-hidden="true">
          {parsed && (
            <span>
              {count} cuotas de {clp(installmentAmount)}
            </span>
          )}
        </div>
      </div>

      <div className="whisper-category-space">
        {creditCards.length > 1 && (
          <div className="whisper-categories" role="group" aria-label="Tarjeta">
            {creditCards.map((card) => (
              <button
                key={card.id}
                type="button"
                className="whisper-category"
                aria-pressed={cardId === card.id}
                style={{ "--whisper-accent": card.color && card.color !== "#000000" ? card.color : FALLBACK_ACCENT } as React.CSSProperties}
                onClick={() => {
                  setCardId(card.id);
                  playTap();
                  inputRef.current?.focus();
                }}
              >
                <span className="whisper-category-dot" aria-hidden="true" />
                {card.name}
                {cardId === card.id && <Check size={12} aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
        <div className="whisper-categories whisper-counts" role="group" aria-label="Cantidad de cuotas">
          {counts.map((n) => (
            <button
              key={n}
              type="button"
              className="whisper-category"
              aria-pressed={count === n}
              onClick={() => {
                setCount(n);
                playTap();
                inputRef.current?.focus();
              }}
            >
              {n} cuotas
            </button>
          ))}
        </div>
        <p className="whisper-caption" aria-live="polite">
          {selectedCard ? `${selectedCard.name} · ` : ""}
          primera cuota en {monthOf(firstDate) || "—"} · {categoryName}
        </p>
      </div>

      <WhisperOptions open={expanded}>
        <label>
          Fecha de compra
          <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} aria-label="Fecha de compra" />
        </label>
        <label>
          Primera cuota
          <input type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} aria-label="Fecha de la primera cuota" />
        </label>
        <label>
          Categoría
          <select value={categoryName} onChange={(e) => setCategoryName(e.target.value)} aria-label="Categoría">
            {!expenseCategories.some((c) => c.name === categoryName) && <option value={categoryName}>{categoryName}</option>}
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.icon || getCategoryIcon(c.name)} {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Notas
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" aria-label="Notas" />
        </label>
      </WhisperOptions>

      {error && (
        <p id="inst-error" role="alert" className="whisper-error">
          {error}
        </p>
      )}

      <div className="whisper-actions">
        <WhisperOptionsToggle expanded={expanded} onToggle={() => setExpanded(!expanded)} />
        <WhisperSubmit label="Guardar compra" disabled={!ready}>
          {isEditing ? "Guardar cambios" : "Agregar compra"}
        </WhisperSubmit>
      </div>
      <WhisperShortcuts id="inst-shortcuts" items={[["↵", "guardar"], ["Esc", "cerrar"]]} />
    </WhisperComposer>
  );
}
