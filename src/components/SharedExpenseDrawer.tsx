import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUp, Check, Plus, X } from "lucide-react";
import { DebtorNameCombobox } from "./DebtorNameCombobox";
import "./whisper.css";

/**
 * Gasto compartido al estilo Whisper: el total como línea grande, "partes
 * iguales" / "a mano" y "yo también" en pastillas, y las personas como filas
 * compactas (nombre con sugerencias, y el monto cuando se reparte a mano).
 * La vista previa dice cuánto queda por repartir o si cuadra. Se abre justo
 * después de guardar un gasto compartido, así que sigue la misma estética.
 */

interface Debtor {
  name: string;
  amount: number;
}

interface SharedExpenseDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  onConfirm: (debtors: Debtor[]) => void;
  suggestions?: string[];
}

const ACCENT = "#f87171";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v);
const parseAmount = (raw: string) => parseInt(raw.replace(/\D/g, ""), 10) || 0;
const formatInput = (amount: number) => (amount ? new Intl.NumberFormat("es-CL").format(amount) : "");

export default function SharedExpenseDrawer({
  open,
  onOpenChange,
  totalAmount,
  onConfirm,
  suggestions = [],
}: SharedExpenseDrawerProps) {
  const [splitMode, setSplitMode] = useState<"equal" | "manual">("equal");
  const [includeMe, setIncludeMe] = useState(true);
  const [debtors, setDebtors] = useState<Debtor[]>([{ name: "", amount: 0 }]);
  const firstNameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDebtors([{ name: "", amount: 0 }]);
    setSplitMode("equal");
    setIncludeMe(true);
  }, [open]);

  const updateDebtor = (index: number, patch: Partial<Debtor>) =>
    setDebtors((previous) => previous.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  const addDebtor = (name = "") => setDebtors((previous) => [...previous, { name, amount: 0 }]);
  const removeDebtor = (index: number) =>
    setDebtors((previous) => (previous.length > 1 ? previous.filter((_, i) => i !== index) : previous));

  // Un nombre sugerido llena la primera fila vacía o agrega una nueva.
  const pickSuggestion = (name: string) => {
    const empty = debtors.findIndex((d) => d.name.trim() === "");
    if (empty >= 0) updateDebtor(empty, { name });
    else addDebtor(name);
  };

  const named = debtors.filter((d) => d.name.trim() !== "");
  const people = includeMe ? named.length + 1 : named.length;
  const equalShare = people > 0 ? Math.round(totalAmount / people) : 0;

  const othersTotal = splitMode === "equal" ? equalShare * named.length : debtors.reduce((sum, d) => sum + d.amount, 0);
  const myShare = includeMe ? (splitMode === "equal" ? equalShare : totalAmount - othersTotal) : 0;
  const assigned = splitMode === "equal" ? othersTotal + myShare : othersTotal + (includeMe ? myShare : 0);
  const missing = totalAmount - assigned;
  const squares = splitMode === "equal" || Math.abs(missing) < 1;
  const isValid = named.length > 0 && squares && (splitMode === "equal" || !includeMe || myShare >= 0);

  const usedNames = new Set(debtors.map((d) => d.name.trim().toLowerCase()));
  const freeSuggestions = suggestions.filter((s) => !usedNames.has(s.trim().toLowerCase())).slice(0, 6);

  const confirm = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid) return;
    const finalDebtors =
      splitMode === "equal"
        ? named.map((d) => ({ ...d, amount: equalShare }))
        : debtors.filter((d) => d.name.trim() !== "" && d.amount > 0);
    if (finalDebtors.length === 0) return;
    onConfirm(finalDebtors);
    onOpenChange(false);
  };

  // La frase de abajo: qué le toca a cada uno, o cuánto falta por repartir.
  let preview = "";
  if (named.length === 0) preview = "¿Con quién lo compartiste?";
  else if (splitMode === "equal") preview = `${formatCurrency(equalShare)} cada uno${includeMe ? ", tú incluido" : ""}`;
  else if (includeMe && myShare < 0) preview = `se pasan por ${formatCurrency(-myShare)}`;
  else if (includeMe) preview = `tu parte queda en ${formatCurrency(myShare)}`;
  else if (Math.abs(missing) < 1) preview = "cuadra ✓";
  else if (missing > 0) preview = `faltan ${formatCurrency(missing)} por repartir`;
  else preview = `se pasan por ${formatCurrency(-missing)}`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="whisper-backdrop" />
        <Dialog.Content
          data-scrollable
          className="whisper-composer"
          style={{ "--whisper-accent": ACCENT } as React.CSSProperties}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            firstNameRef.current?.querySelector("input")?.focus();
          }}
        >
          <Dialog.Title className="sr-only">Gasto compartido</Dialog.Title>
          <Dialog.Description className="sr-only">
            Reparte el gasto entre las personas que deben. Elige partes iguales o montos a mano, y si tú también participas.
          </Dialog.Description>
          <Dialog.Close className="whisper-close" aria-label="Cerrar">
            <X size={16} />
          </Dialog.Close>

          <form onSubmit={confirm} className="whisper-form">
            <div className="whisper-type" data-static>
              <span className="whisper-dot" aria-hidden="true" />
              <span>Gasto compartido</span>
            </div>

            <div className="whisper-entry">
              <p className="whisper-input whisper-shared-total" aria-label="Total del gasto">
                {formatCurrency(totalAmount)}
              </p>
              <div className="whisper-preview" aria-live="polite">
                <span>{preview}</span>
              </div>
            </div>

            <div className="whisper-category-space">
              <div className="whisper-categories" role="group" aria-label="Cómo dividir">
                <button type="button" className="whisper-category" aria-pressed={splitMode === "equal"} onClick={() => setSplitMode("equal")}>
                  <span className="whisper-category-dot" aria-hidden="true" />
                  Partes iguales
                  {splitMode === "equal" && <Check size={12} aria-hidden="true" />}
                </button>
                <button type="button" className="whisper-category" aria-pressed={splitMode === "manual"} onClick={() => setSplitMode("manual")}>
                  <span className="whisper-category-dot" aria-hidden="true" />
                  A mano
                  {splitMode === "manual" && <Check size={12} aria-hidden="true" />}
                </button>
                <button type="button" className="whisper-category" aria-pressed={includeMe} onClick={() => setIncludeMe(!includeMe)}>
                  <span className="whisper-category-dot" aria-hidden="true" />
                  Yo también
                  {includeMe && <Check size={12} aria-hidden="true" />}
                </button>
              </div>
              {freeSuggestions.length > 0 && (
                <div className="whisper-categories whisper-shared-suggestions" role="group" aria-label="Personas frecuentes">
                  {freeSuggestions.map((name) => (
                    <button key={name} type="button" className="whisper-category" onClick={() => pickSuggestion(name)}>
                      <Plus size={11} aria-hidden="true" />
                      {name}
                    </button>
                  ))}
                </div>
              )}
              <p className="whisper-caption" aria-hidden="true">
                {splitMode === "equal" ? "Se divide entre quienes nombres" : "Escribe cuánto le toca a cada uno"}
                {includeMe ? " y tú" : ""}
              </p>
            </div>

            <div className="whisper-shared-rows" role="group" aria-label="Personas que deben">
              {debtors.map((debtor, index) => (
                <div key={index} className="whisper-shared-row" data-manual={splitMode === "manual" || undefined} ref={index === 0 ? firstNameRef : undefined}>
                  <DebtorNameCombobox
                    placeholder="Nombre"
                    value={debtor.name}
                    onChange={(name) => updateDebtor(index, { name })}
                    suggestions={suggestions}
                    className="whisper-shared-name"
                  />
                  {splitMode === "manual" ? (
                    <input
                      inputMode="numeric"
                      placeholder="Monto"
                      aria-label={`Monto de ${debtor.name || "esta persona"}`}
                      value={formatInput(debtor.amount)}
                      onChange={(e) => updateDebtor(index, { amount: parseAmount(e.target.value) })}
                      className="whisper-shared-amount"
                    />
                  ) : (
                    <span className="whisper-shared-amount whisper-shared-fixed" aria-hidden="true">
                      {debtor.name.trim() ? formatCurrency(equalShare) : ""}
                    </span>
                  )}
                  <button
                    type="button"
                    className="whisper-shared-remove"
                    onClick={() => removeDebtor(index)}
                    disabled={debtors.length === 1}
                    aria-label="Quitar persona"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <button type="button" className="whisper-shared-add" onClick={() => addDebtor()}>
                <Plus size={12} aria-hidden="true" /> Otra persona
              </button>
            </div>

            <div className="whisper-actions">
              <button type="submit" className="whisper-submit" disabled={!isValid} aria-label="Confirmar reparto">
                Confirmar
                <span className="hidden sm:inline" aria-hidden="true">↵</span>
                <ArrowUp size={14} className="sm:hidden" aria-hidden="true" />
              </button>
            </div>
            <p className="whisper-shortcuts">
              <span>
                <kbd>↵</kbd> confirmar
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
