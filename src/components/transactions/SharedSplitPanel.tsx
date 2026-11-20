import { useState } from "react";
import { Check, CheckCircle2, Clock, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useSharedExpenses, type SharedExpense } from "@/hooks/useSharedExpenses";
import type { Transaction } from "@/hooks/useTransactions";
import { cn } from "@/lib/utils";
import { clp } from "@/lib/format";

interface SharedSplitPanelProps {
  transaction: Transaction;
  existingShared: SharedExpense[];
  liveAmount: number;
  effectiveAmount: number;
  blur: boolean;
  onRequestPaid: (paid: { id: string; name: string; amount: number; detail?: string }) => void;
}

export function SharedSplitPanel({ transaction, existingShared, liveAmount, effectiveAmount, blur, onRequestPaid }: SharedSplitPanelProps) {
  const { addSharedExpenses, updateSharedExpenseAmount, deleteSharedExpense, uniqueDebtorNames } = useSharedExpenses();
  const [newDebtor, setNewDebtor] = useState<{ name: string; amount: string } | null>(null);
  const [editingDebtor, setEditingDebtor] = useState<{ id: string; amount: string } | null>(null);

  const alreadyAssignedAll = existingShared.reduce((sum, se) => sum + se.amount_owed, 0);
  const alreadyAssignedPending = existingShared.filter((se) => !se.paid).reduce((sum, se) => sum + se.amount_owed, 0);
  const myShare = liveAmount - alreadyAssignedPending;
  const remaining = liveAmount - alreadyAssignedAll;
  const newAmount = parseFloat(newDebtor?.amount || "0");
  const exceedsLimit = newAmount > remaining;
  const isFormValid = newDebtor?.name.trim() && newDebtor.amount && !exceedsLimit;

  return (
    <div className="whisper-tx-panel">
      <div className="whisper-tx-panel-head">
        <span><Users aria-hidden="true" /> Gasto compartido</span>
        {!newDebtor && (
          <button type="button" className="whisper-tx-mini" onClick={() => setNewDebtor({ name: "", amount: "" })}>
            <Plus size={11} /> Persona
          </button>
        )}
      </div>

      {existingShared.map((se) => {
        const draft = editingDebtor?.id === se.id ? editingDebtor.amount : null;
        const isEditingThis = draft !== null;
        const editAmount = parseFloat(draft || "0");
        const otherAssigned = existingShared.filter((s) => s.id !== se.id).reduce((sum, s) => sum + s.amount_owed, 0);
        const editRemaining = effectiveAmount - otherAssigned;
        const editExceeds = editAmount > editRemaining;
        const editValid = draft && editAmount > 0 && !editExceeds;
        const saveAmount = () =>
          updateSharedExpenseAmount.mutate(
            { id: se.id, amount_owed: editAmount },
            { onSuccess: () => setEditingDebtor(null) },
          );

        return (
          <div key={se.id} className="whisper-tx-row" data-paid={se.paid || undefined}>
            {se.paid ? (
              <CheckCircle2 size={14} className="whisper-tx-status paid" aria-label="Pagado" />
            ) : (
              <Clock size={14} className="whisper-tx-status" aria-label="Pendiente" />
            )}
            <span className="name">
              <span>{se.debtor_name}</span>
              {se.paid && (
                <small>Pagado {se.paid_at ? new Date(se.paid_at).toLocaleDateString("es-CL") : ""}</small>
              )}
              {isEditingThis && editExceeds && (
                <small className="warn">Máximo disponible: {clp(editRemaining)}</small>
              )}
            </span>
            {isEditingThis ? (
              <span className="whisper-tx-inline">
                <input
                  className="amt"
                  inputMode="numeric"
                  aria-label={`Monto de ${se.debtor_name}`}
                  value={draft}
                  onChange={(e) => setEditingDebtor({ id: se.id, amount: e.target.value.replace(/\D/g, "") })}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editValid) {
                      e.preventDefault();
                      saveAmount();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingDebtor(null);
                    }
                  }}
                />
                <button
                  type="button"
                  className="whisper-tx-icon-btn"
                  aria-label="Guardar monto"
                  disabled={!editValid}
                  onClick={saveAmount}
                >
                  <Check size={13} />
                </button>
                <button
                  type="button"
                  className="whisper-tx-icon-btn"
                  aria-label="Cancelar"
                  onClick={() => setEditingDebtor(null)}
                >
                  <X size={13} />
                </button>
              </span>
            ) : (
              <>
                <span className={cn("amt", blur && "privacy-blur")}>{clp(se.amount_owed)}</span>
                <span className="whisper-tx-row-actions">
                  {!se.paid && (
                    <>
                      <button
                        type="button"
                        className="whisper-tx-icon-btn"
                        aria-label={`Editar monto de ${se.debtor_name}`}
                        onClick={() => setEditingDebtor({ id: se.id, amount: se.amount_owed.toString() })}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        className="whisper-tx-mini"
                        onClick={() =>
                          onRequestPaid({
                            id: se.id,
                            name: se.debtor_name,
                            amount: se.amount_owed,
                            detail: transaction.detail || undefined,
                          })
                        }
                      >
                        <CheckCircle2 size={11} /> Pagado
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="whisper-tx-icon-btn danger"
                    aria-label={`Quitar a ${se.debtor_name}`}
                    onClick={() => deleteSharedExpense.mutate(se.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              </>
            )}
          </div>
        );
      })}

      {myShare >= 0 && (
        <div className="whisper-tx-foot">
          <span>Tu parte</span>
          <b className={cn(blur && "privacy-blur")}>{clp(myShare)}</b>
        </div>
      )}

      {newDebtor && (
        <div className="whisper-tx-add">
          <div className="whisper-tx-foot">
            <span>Disponible para asignar</span>
            <b className={cn(remaining <= 0 && "warn", blur && "privacy-blur")}>{clp(remaining)}</b>
          </div>
          <div className="whisper-tx-inline">
            <input
              className="grow"
              placeholder="Nombre"
              aria-label="Nombre de la persona"
              list="tx-debtor-suggestions"
              value={newDebtor.name}
              onChange={(e) => setNewDebtor({ ...newDebtor, name: e.target.value })}
              autoFocus
            />
            <datalist id="tx-debtor-suggestions">
              {uniqueDebtorNames("they_owe_me").map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <input
              className={cn("amt", exceedsLimit && "invalid")}
              inputMode="numeric"
              placeholder="Monto"
              aria-label="Monto que debe"
              value={newDebtor.amount}
              onChange={(e) => setNewDebtor({ ...newDebtor, amount: e.target.value.replace(/\D/g, "") })}
            />
            <button
              type="button"
              className="whisper-tx-mini primary"
              disabled={!isFormValid}
              onClick={() =>
                addSharedExpenses.mutate(
                  [{
                    transaction_id: transaction.id,
                    debtor_name: newDebtor.name.trim(),
                    amount_owed: newAmount,
                    detail: null,
                  }],
                  { onSuccess: () => setNewDebtor(null) },
                )
              }
            >
              <Check size={12} /> Agregar
            </button>
            <button
              type="button"
              className="whisper-tx-icon-btn"
              aria-label="Cancelar"
              onClick={() => setNewDebtor(null)}
            >
              <X size={13} />
            </button>
          </div>
          {exceedsLimit && (
            <p className="whisper-tx-note warn">El monto supera el disponible ({clp(remaining)})</p>
          )}
        </div>
      )}
    </div>
  );
}
