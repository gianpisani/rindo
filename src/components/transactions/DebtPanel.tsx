import type { ReactNode } from "react";
import { Check, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { clp } from "@/lib/format";

interface DebtPanelProps {
  title: string;
  onClose?: () => void;
  debts: Array<{ id: string; name: string; amount: number; detail: ReactNode; onToggle: () => void }>;
  selected: Array<{ id: string; amount: number }>;
  txAmount: number;
  blur: boolean;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
}

export function DebtPanel({ title, onClose, debts, selected, txAmount, blur, confirmLabel, pending, onConfirm }: DebtPanelProps) {
  const selectedTotal = selected.reduce((sum, d) => sum + d.amount, 0);
  const totalMismatch = txAmount > 0 && selected.length > 0 && Math.abs(txAmount - selectedTotal) > 1;
  const plural = selected.length > 1 ? "s" : "";

  return (
    <div className="whisper-tx-panel">
      <div className="whisper-tx-panel-head">
        <span><Users aria-hidden="true" /> {title}</span>
        {onClose && (
          <button type="button" className="whisper-tx-icon-btn" aria-label="Cerrar" onClick={onClose}>
            <X size={13} />
          </button>
        )}
      </div>
      {debts.map((debt) => {
        const isSelected = selected.some((d) => d.id === debt.id);
        return (
          <div
            key={debt.id}
            role="checkbox"
            aria-checked={isSelected}
            tabIndex={0}
            onClick={debt.onToggle}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                debt.onToggle();
              }
            }}
            className="whisper-tx-row"
          >
            <span className="whisper-tx-check" aria-hidden="true">{isSelected && <Check size={10} />}</span>
            <span className="name">
              <span>{debt.name}</span>
              <small>{debt.detail}</small>
            </span>
            <span className={cn("amt", blur && "privacy-blur")}>{clp(debt.amount)}</span>
          </div>
        );
      })}
      {selected.length > 0 && (
        <>
          <div className="whisper-tx-foot">
            <span>
              {selected.length} deuda{plural} seleccionada{plural}
            </span>
            <b className={cn(totalMismatch && "warn", blur && "privacy-blur")}>{clp(selectedTotal)}</b>
          </div>
          <button type="button" className="whisper-tx-mini primary" disabled={pending} onClick={onConfirm}>
            <Check size={12} /> {confirmLabel}
          </button>
        </>
      )}
    </div>
  );
}
