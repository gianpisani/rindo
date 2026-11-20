import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Plus, Users, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import SharedExpenseDrawer from "@/components/transactions/SharedExpenseDrawer";
import { DebtPanel } from "@/components/transactions/DebtPanel";
import { SharedSplitPanel } from "@/components/transactions/SharedSplitPanel";
import { InlineCategoryCreator } from "@/components/transactions/InlineCategoryCreator";
import { useTransactions } from "@/hooks/useTransactions";
import { useCreditCards } from "@/hooks/useCreditCards";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import type { TxEditorState } from "@/hooks/useTxEditor";
import { getCategoryIcon } from "@/lib/category-icon";
import { WHISPER_TYPES } from "@/lib/whisper";
import type { TransactionType } from "@/lib/ledger";
import { cn } from "@/lib/utils";
import { clp } from "@/lib/format";
import "@/components/shared/whisper.css";

const SIGN_OPTIONS = [
  { loss: false, label: "Ganancia" },
  { loss: true, label: "Pérdida" },
];

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });

export function TxEditor({ editor }: { editor: TxEditorState }) {
  const { transactions } = useTransactions();
  const { creditCards } = useCreditCards();
  const { isPrivacyMode } = usePrivacyMode();
  const reducedMotion = useReducedMotion();
  const { transaction, form, categories, newCategory, debts, shared, paid } = editor;
  const card = creditCards.find((c) => c.id === form.card_id);

  return (
    <>
      {transaction && (
        <Dialog.Root open={editor.isOpen} onOpenChange={editor.onOpenChange}>
          <Dialog.Portal>
            <Dialog.Overlay className="whisper-backdrop" />
            <Dialog.Content
              data-scrollable
              className="whisper-composer"
              style={{ "--whisper-accent": editor.accent } as React.CSSProperties}
              onOpenAutoFocus={(event) => event.preventDefault()}
            >
              <Dialog.Title className="sr-only">Editar movimiento</Dialog.Title>
              <Dialog.Description className="sr-only">
                Toca una categoría para corregirla y guardar. El nombre se edita en el título; monto, fecha y cuenta, en detalles.
              </Dialog.Description>
              <Dialog.Close className="whisper-close" aria-label="Cerrar">
                <X size={16} />
              </Dialog.Close>

              <form id="transaction-form" onSubmit={editor.submit} className="whisper-form edit-tx">
                <div className="whisper-type">
                  <span className="whisper-dot" aria-hidden="true" />
                  <span aria-hidden="true">{form.type}</span>
                  <select
                    aria-label="Tipo de movimiento"
                    value={form.type}
                    onChange={(event) => editor.changeType(event.target.value as TransactionType)}
                  >
                    {WHISPER_TYPES.map((t) => (
                      <option key={t.type}>{t.type}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} aria-hidden="true" />
                </div>

                <div className="edit-tx-head">
                  <input
                    aria-label="Nombre del movimiento"
                    className={cn("edit-tx-title", isPrivacyMode && "privacy-blur")}
                    autoComplete="off"
                    maxLength={200}
                    value={editor.detailText}
                    placeholder={transaction.bank_description || "Sin nombre"}
                    onChange={(event) => editor.setDetailText(event.target.value)}
                  />
                  <p className="edit-tx-meta">
                    <b className={cn(isPrivacyMode && "privacy-blur")}>
                      {form.type === "Rendimiento" && form.isLoss ? "−" : ""}
                      {clp(editor.effectiveAmount)}
                    </b>
                    {Number.isFinite(new Date(form.date).getTime()) && (
                      <span>{format(new Date(form.date), "d MMM, HH:mm", { locale: es })}</span>
                    )}
                    {card && <span>{card.name}{card.last_4_digits ? ` ···${card.last_4_digits}` : ""}</span>}
                  </p>
                </div>

                <div className="whisper-category-space">
                  {form.type === "Rendimiento" && (
                    <div className="whisper-categories whisper-tx-sign" role="group" aria-label="Ganancia o pérdida">
                      {SIGN_OPTIONS.map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          className="whisper-category"
                          aria-pressed={form.isLoss === opt.loss}
                          onClick={() => editor.patchForm({ isLoss: opt.loss })}
                        >
                          <span className="whisper-category-dot" aria-hidden="true" />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {newCategory.draft ? (
                    <InlineCategoryCreator
                      draft={newCategory.draft}
                      typeLabel={form.type}
                      creating={newCategory.isCreating}
                      onChange={newCategory.update}
                      onCreate={newCategory.create}
                      onCancel={newCategory.cancel}
                    />
                  ) : (
                    <div className="whisper-categories" role="group" aria-label="Categoría (tocar guarda)">
                      {categories.visible.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          className="whisper-category"
                          aria-pressed={form.category_name === category.name}
                          disabled={editor.isSaving}
                          onClick={() => editor.saveEdit({ category_name: category.name })}
                        >
                          <span className="whisper-category-dot" aria-hidden="true" />
                          {category.icon || getCategoryIcon(category.name)} {category.name}
                          {form.category_name === category.name && <Check size={12} aria-hidden="true" />}
                        </button>
                      ))}
                      {categories.hasMore && (
                        <button
                          type="button"
                          className="whisper-more-categories"
                          aria-expanded={categories.showAll}
                          onClick={categories.toggleShowAll}
                        >
                          {categories.showAll ? "Menos" : `Ver todas (${categories.available.length})`}
                        </button>
                      )}
                      {(categories.showAll || !categories.hasMore) && (
                        <button type="button" className="whisper-more-categories" onClick={newCategory.start}>
                          <Plus size={11} aria-hidden="true" /> Nueva
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {shared.canSplit && (
                  <button
                    type="button"
                    className="whisper-more-categories edit-tx-split"
                    disabled={editor.isSaving}
                    onClick={shared.startSplit}
                  >
                    <Users size={12} aria-hidden="true" /> Dividir gasto
                  </button>
                )}

                <AnimatePresence initial={false}>
                  {editor.expanded && (
                    <motion.div
                      className="whisper-options"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: reducedMotion ? 0 : 0.18 }}
                    >
                      <label>
                        Monto
                        <input
                          inputMode="numeric"
                          aria-label="Monto"
                          className={cn(isPrivacyMode && "privacy-blur")}
                          value={form.value}
                          onChange={(event) => editor.changeAmount(event.target.value)}
                        />
                      </label>
                      <label>
                        Fecha y hora
                        <input
                          type="datetime-local"
                          aria-label="Fecha y hora del movimiento"
                          value={form.date}
                          onChange={(event) => editor.patchForm({ date: event.target.value })}
                        />
                      </label>
                      {form.type !== "Inversión" && creditCards.length > 0 && (
                        <label>
                          Cuenta
                          <select
                            aria-label="Cuenta o tarjeta"
                            value={form.card_id ?? ""}
                            onChange={(event) => editor.patchForm({ card_id: event.target.value || null })}
                          >
                            <option value="">Sin tarjeta</option>
                            {creditCards
                              .filter((c) => c.is_active)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                  {c.last_4_digits ? ` ···· ${c.last_4_digits}` : ""}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}
                      {debts.canSettleDebt && (
                        <label className="whisper-check">
                          <input
                            type="checkbox"
                            checked={debts.settleDebtToggle}
                            onChange={(event) => debts.changeSettleDebtToggle(event.target.checked)}
                          />
                          Salda una deuda que debo
                        </label>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {debts.showLinkPanel && (
                  <DebtPanel
                    title="Vincular a una deuda pendiente"
                    debts={debts.pendingDebts.map((debt) => ({
                      id: debt.id,
                      name: debt.debtor_name,
                      amount: debt.amount_owed,
                      detail: (
                        <>
                          {debt.transaction_detail || "Sin detalle"}{debt.transaction_date && ` · ${shortDate(debt.transaction_date)}`}
                          {debts.debtsToLink.length <= 1 && editor.effectiveAmount > 0 && Math.abs(editor.effectiveAmount - debt.amount_owed) > 1 && " · monto distinto a la deuda"}
                        </>
                      ),
                      onToggle: () =>
                        debts.toggleDebtToLink({
                          id: debt.id,
                          debtorName: debt.debtor_name,
                          amount: debt.amount_owed,
                          transactionDetail: debt.transaction_detail || undefined,
                        }),
                    }))}
                    selected={debts.debtsToLink}
                    txAmount={editor.effectiveAmount}
                    blur={isPrivacyMode}
                    confirmLabel="Vincular seleccionadas"
                    pending={debts.linkPending}
                    onConfirm={debts.linkDebts}
                  />
                )}

                {shared.showPanel && (
                  <SharedSplitPanel
                    transaction={transaction}
                    existingShared={shared.existing}
                    liveAmount={transactions.find((t) => t.id === transaction.id)?.amount ?? editor.effectiveAmount}
                    effectiveAmount={editor.effectiveAmount}
                    blur={isPrivacyMode}
                    onRequestPaid={paid.request}
                  />
                )}

                {debts.showSettlePanel && (
                  <DebtPanel
                    title="Saldar una deuda que debo"
                    onClose={() => debts.changeSettleDebtToggle(false)}
                    debts={debts.pendingIOwe.map((debt) => ({
                      id: debt.id,
                      name: debt.debtor_name,
                      amount: debt.amount_owed,
                      detail: debt.transaction_detail || debt.detail || "Sin detalle",
                      onToggle: () => debts.toggleDebtIOwe({ id: debt.id, debtorName: debt.debtor_name, amount: debt.amount_owed }),
                    }))}
                    selected={debts.debtsIOweToSettle}
                    txAmount={editor.effectiveAmount}
                    blur={isPrivacyMode}
                    confirmLabel="Saldar seleccionadas"
                    pending={debts.settlePending}
                    onConfirm={debts.settleDebts}
                  />
                )}

                {editor.error && (
                  <p id="tx-error" role="alert" className="whisper-error">
                    {editor.error}
                  </p>
                )}

                <div className="whisper-actions">
                  <button
                    type="button"
                    className="whisper-options-toggle"
                    aria-expanded={editor.expanded}
                    onClick={editor.toggleExpanded}
                  >
                    {editor.expanded ? "Ocultar detalles" : "Monto, fecha y cuenta"}
                    <ChevronDown size={12} className={cn(editor.expanded && "rotate-180")} />
                  </button>
                  <button type="submit" className="whisper-submit" disabled={editor.isSaving}>
                    Guardar
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      <SharedExpenseDrawer
        open={shared.splitDrawerOpen}
        onOpenChange={shared.setSplitDrawerOpen}
        totalAmount={shared.splitAmount}
        onConfirm={shared.confirmSplit}
        suggestions={shared.debtorSuggestions}
      />

      <AlertDialog open={!!paid.confirmation} onOpenChange={paid.cancel}>
        <AlertDialogContent
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              paid.confirm();
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Se creará automáticamente un reembolso de{" "}
              <span className="font-medium">
                ${paid.confirmation && new Intl.NumberFormat("es-CL").format(paid.confirmation.amount)}
              </span>{" "}
              por el pago de <span className="font-medium">{paid.confirmation?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={paid.confirm}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
