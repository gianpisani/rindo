import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Check, ChevronDown, X } from "lucide-react";
import { addMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import { parseWhisper } from "@/lib/whisper";
import { getCategoryIcon } from "./TransactionsTable";
import type { InstallmentPurchase } from "@/hooks/useInstallments";
import type { CreditCard } from "@/hooks/useCreditCards";
import { useCategories } from "@/hooks/useCategories";
import { useSoundFX } from "@/hooks/useSoundFX";
import { cn } from "@/lib/utils";
import "./whisper.css";

/**
 * Compra en cuotas al estilo Whisper: una línea con el total y qué compraste
 * ("1498800 MacBook Air"), la tarjeta y la cantidad de cuotas en pastillas,
 * y la cuota resultante como vista previa. Fechas, categoría y notas viven en
 * "Más opciones". El composer toma el color de la tarjeta elegida.
 */

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
const FALLBACK_ACCENT = "#f87171";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v);
const isoDay = (d: Date) => format(d, "yyyy-MM-dd");
const monthOf = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isFinite(d.getTime()) ? format(d, "MMMM yyyy", { locale: es }) : "";
};

export function InstallmentModal({ open, onOpenChange, installment, creditCards, onSave }: InstallmentModalProps) {
  const { categories } = useCategories();
  const { playTap } = useSoundFX();
  const reducedMotion = useReducedMotion();
  const [value, setValue] = useState("");
  const [count, setCount] = useState(6);
  const [cardId, setCardId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(isoDay(new Date()));
  const [firstDate, setFirstDate] = useState(isoDay(addMonths(new Date(), 1)));
  const [categoryName, setCategoryName] = useState(DEFAULT_CATEGORY);
  const [notes, setNotes] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!installment;
  const parsed = parseWhisper(value);
  const description = parsed?.detail ?? "";
  const installmentAmount = parsed ? Math.ceil(parsed.amount / count) : 0;
  const ready = !!parsed && description.length > 0 && !!cardId;
  const selectedCard = creditCards.find((c) => c.id === cardId);
  const expenseCategories = categories.filter((c) => c.type === "Gasto" && c.is_active !== false);
  // Una cantidad rara (10, 48) se muestra como pastilla propia mientras se edita.
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
  }, [installment, open, creditCards]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving.current) return;
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
    saving.current = true;
    try {
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
    } catch {
      setError("No se guardó la compra. Intenta de nuevo.");
    } finally {
      saving.current = false;
    }
  };

  const accent = selectedCard?.color && selectedCard.color !== "#000000" ? selectedCard.color : FALLBACK_ACCENT;

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
          <Dialog.Title className="sr-only">{isEditing ? "Editar compra" : "Nueva compra en cuotas"}</Dialog.Title>
          <Dialog.Description className="sr-only">
            Escribe el total y qué compraste en una línea. Abajo eliges la tarjeta y la cantidad de cuotas. En más opciones están las fechas, la categoría y las notas.
          </Dialog.Description>
          <Dialog.Close className="whisper-close" aria-label="Cerrar">
            <X size={16} />
          </Dialog.Close>

          <form onSubmit={submit} className="whisper-form">
            <div className="whisper-type" data-static>
              <span className="whisper-dot" aria-hidden="true" />
              <span>{isEditing ? "Editar compra" : "Compra en cuotas"}</span>
            </div>

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
                    {count} cuotas de {formatCurrency(installmentAmount)}
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

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  className="whisper-options"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.18 }}
                >
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
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <p id="inst-error" role="alert" className="whisper-error">
                {error}
              </p>
            )}

            <div className="whisper-actions">
              <button type="button" className="whisper-options-toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                {expanded ? "Menos opciones" : "Más opciones"}
                <ChevronDown size={12} className={cn(expanded && "rotate-180")} />
              </button>
              <button type="submit" className="whisper-submit" disabled={!ready} aria-label="Guardar compra">
                {isEditing ? "Guardar cambios" : "Agregar compra"}
                <span className="hidden sm:inline" aria-hidden="true">↵</span>
                <ArrowUp size={14} className="sm:hidden" aria-hidden="true" />
              </button>
            </div>
            <p id="inst-shortcuts" className="whisper-shortcuts">
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
