import { useEffect, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { DebtorNameCombobox } from "./DebtorNameCombobox";
import { WhisperComposer, WhisperShortcuts, WhisperStaticType, WhisperSubmit } from "@/components/shared/whisper/WhisperComposer";
import { clp, groupDigits, parseAmount } from "@/lib/format";

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

const formatInput = (amount: number) => (amount ? groupDigits(amount) : "");

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

  let preview = "";
  if (named.length === 0) preview = "¿Con quién lo compartiste?";
  else if (splitMode === "equal") preview = `${clp(equalShare)} cada uno${includeMe ? ", tú incluido" : ""}`;
  else if (includeMe && myShare < 0) preview = `se pasan por ${clp(-myShare)}`;
  else if (includeMe) preview = `tu parte queda en ${clp(myShare)}`;
  else if (Math.abs(missing) < 1) preview = "cuadra ✓";
  else if (missing > 0) preview = `faltan ${clp(missing)} por repartir`;
  else preview = `se pasan por ${clp(-missing)}`;

  return (
    <WhisperComposer
      open={open}
      onOpenChange={onOpenChange}
      title="Gasto compartido"
      description="Reparte el gasto entre las personas que deben. Elige partes iguales o montos a mano, y si tú también participas."
      focusOnOpen={() => firstNameRef.current?.querySelector("input")?.focus()}
      onSubmit={confirm}
    >
      <WhisperStaticType>Gasto compartido</WhisperStaticType>

      <div className="whisper-entry">
        <p className="whisper-input whisper-shared-total" aria-label="Total del gasto">
          {clp(totalAmount)}
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
                {debtor.name.trim() ? clp(equalShare) : ""}
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
        <WhisperSubmit label="Confirmar reparto" disabled={!isValid}>
          Confirmar
        </WhisperSubmit>
      </div>
      <WhisperShortcuts items={[["↵", "confirmar"], ["Esc", "cerrar"]]} />
    </WhisperComposer>
  );
}
