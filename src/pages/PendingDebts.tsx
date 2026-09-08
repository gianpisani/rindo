import { useState, useRef, useEffect } from "react";
import Layout from "@/components/Layout";
import { Screen, Row, Panel } from "@/components/HairlineGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BaseModal } from "@/components/BaseModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { DebtorNameCombobox } from "@/components/DebtorNameCombobox";
import { useSharedExpenses, type SharedExpenseDirection } from "@/hooks/useSharedExpenses";
import { useTransactions } from "@/hooks/useTransactions";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { cn } from "@/lib/utils";
import {
  Plus,
  CheckCircle2,
  Trash2,
  Users,
  ChevronDown,
  Receipt,
  HandCoins,
} from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";

const fmt = (n: number) => `$${new Intl.NumberFormat("es-CL").format(n)}`;

const formatCurrency = (value: string) => {
  const number = value.replace(/\D/g, "");
  if (!number) return "";
  return `$${new Intl.NumberFormat("es-CL").format(parseInt(number))}`;
};

const parseRawAmount = (value: string) => {
  const clean = value.replace(/[$.,\s]/g, "");
  return parseFloat(clean) || 0;
};

export default function PendingDebts() {
  const {
    pendingByDebtor,
    pendingByCreditor,
    sharedExpensesWithTransaction,
    markAsPaid,
    settleDebtsIOwe,
    deleteSharedExpense,
    addQuickDebt,
    addManualDebtIOwe,
    uniqueDebtorNames,
    isLoading,
  } = useSharedExpenses();
  const { transactions } = useTransactions();
  const { isPrivacyMode } = usePrivacyMode();

  const [direction, setDirection] = useState<SharedExpenseDirection>("they_owe_me");

  const [confirmPaid, setConfirmPaid] = useState<{
    id: string;
    name: string;
    amount: number;
    detail?: string;
  } | null>(null);
  const [settleTarget, setSettleTarget] = useState<{ id: string; name: string; amount: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const [newDebt, setNewDebt] = useState({ name: "", amount: "", detail: "" });
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Focus amount input when modal opens
  useEffect(() => {
    if (showAddModal) {
      setTimeout(() => amountInputRef.current?.focus(), 100);
    }
  }, [showAddModal]);

  const handleMarkAsPaid = async () => {
    if (!confirmPaid) return;
    await markAsPaid.mutateAsync({
      sharedExpenseId: confirmPaid.id,
      debtorName: confirmPaid.name,
      amount: confirmPaid.amount,
      transactionDetail: confirmPaid.detail,
    });
    setConfirmPaid(null);
  };

  const handleSettleWithTransaction = async (transactionId: string) => {
    if (!settleTarget) return;
    await settleDebtsIOwe.mutateAsync({
      debts: [{ sharedExpenseId: settleTarget.id }],
      existingTransactionId: transactionId,
    });
    setSettleTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (confirmDelete.id) {
      await deleteSharedExpense.mutateAsync(confirmDelete.id);
    }
  };

  const handleAddDebt = async () => {
    const amount = parseRawAmount(newDebt.amount);
    if (!newDebt.name.trim() || !amount || amount <= 0) return;
    if (direction === "they_owe_me") {
      await addQuickDebt.mutateAsync({
        debtorName: newDebt.name.trim(),
        amount,
        detail: newDebt.detail.trim() || undefined,
      });
    } else {
      await addManualDebtIOwe.mutateAsync({
        creditorName: newDebt.name.trim(),
        amount,
        detail: newDebt.detail.trim() || undefined,
      });
    }
    setNewDebt({ name: "", amount: "", detail: "" });
    setShowAddModal(false);
  };

  const getExpensesForPerson = (name: string) =>
    sharedExpensesWithTransaction.filter(
      (exp) => exp.debtor_name === name && !exp.paid && exp.direction === direction
    );

  const paidExpenses = sharedExpensesWithTransaction.filter(
    (exp) => exp.paid && exp.direction === direction
  );

  const isOwedToMe = direction === "they_owe_me";
  const summary = isOwedToMe
    ? pendingByDebtor.map((d) => ({ name: d.debtor_name, total_owed: d.total_owed, count_expenses: d.count_expenses }))
    : pendingByCreditor.map((d) => ({ name: d.creditor_name, total_owed: d.total_owed, count_expenses: d.count_expenses }));

  const totalPending = summary.reduce((s, d) => s + d.total_owed, 0);
  const totalExpenses = summary.reduce((s, d) => s + d.count_expenses, 0);

  const recentGastos = transactions
    .filter((t) => t.type === "Gasto")
    .slice(0, 30);

  if (isLoading) {
    return (
      <Layout>
        <LoadingScreen fullScreen={false} size="md" />
      </Layout>
    );
  }

  return (
    <Layout bleed>
      {/* Mismo chasis que Inicio: identidad, el conmutador de dirección
          como franja de dos celdas, los tres indicadores, y la lista de
          personas como la fila que cede. El historial de pagados va
          abajo del pliegue: es archivo, no lo que estás mirando. */}
      <Screen>
        {/* ── Fila 1 — identidad y el verbo de la página ─────────── */}
        <Panel className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-5 lg:shrink-0">
          <div className="min-w-0">
            <h1 className="page-title text-xl md:text-2xl">Deudas</h1>
            <p className="eyebrow mt-1">
              {summary.length} {summary.length === 1 ? "persona" : "personas"}
              {" · "}
              {totalExpenses} {totalExpenses === 1 ? "gasto" : "gastos"}
            </p>
          </div>
          <Button size="sm" className="ml-auto gap-2" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nueva deuda</span>
          </Button>
        </Panel>

        {/* ── Fila 2 — de qué lado estás mirando. Dos celdas, y la
            activa es el bloque de acento: la pastilla dentro de una
            caja era una forma flotando dentro de otra. ──────────── */}
        <Row className="grid-cols-2 lg:shrink-0">
          <button
            onClick={() => setDirection("they_owe_me")}
            className={cn(
              "native-press section-title bg-card px-4 py-2.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              isOwedToMe
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Me deben
          </button>
          <button
            onClick={() => setDirection("i_owe_them")}
            className={cn(
              "native-press section-title bg-card px-4 py-2.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              !isOwedToMe
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Yo debo
          </button>
        </Row>

        {/* ── Fila 3 — los tres indicadores ──────────────────────── */}
        <Row className="grid-cols-3 lg:shrink-0">
          <Panel className="px-4 py-3 md:px-5">
            <p className="eyebrow">Pendiente</p>
            <p
              className={cn(
                "mt-1.5 font-mono text-base font-bold tracking-tight tabular-nums md:text-lg",
                isOwedToMe ? "text-warning" : "text-destructive",
                isPrivacyMode && "privacy-blur"
              )}
            >
              {fmt(totalPending)}
            </p>
          </Panel>

          <Panel className="px-4 py-3 md:px-5">
            <p className="eyebrow">{isOwedToMe ? "Te deben" : "Le debes a"}</p>
            <p className="mt-1.5 flex items-center gap-1.5 font-mono text-base font-bold tracking-tight tabular-nums md:text-lg">
              <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {summary.length}
            </p>
          </Panel>

          <Panel className="px-4 py-3 md:px-5">
            <p className="eyebrow">Gastos</p>
            <p className="mt-1.5 flex items-center gap-1.5 font-mono text-base font-bold tracking-tight tabular-nums md:text-lg">
              <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {totalExpenses}
            </p>
          </Panel>
        </Row>

        {/* ── Fila 4 — la lista por persona. Esta es la que cede:
            scrollea por dentro y llena cualquier alto. ─────────── */}
        <Panel className="flex flex-col lg:min-h-0 lg:flex-1">
          {summary.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-14 text-center">
              <div className="flex size-14 items-center justify-center border border-border">
                <Users className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="section-title text-sm">
                {isOwedToMe ? "No hay deudas pendientes" : "No le debes plata a nadie"}
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                {isOwedToMe
                  ? "Agrega una deuda o divide un gasto compartido."
                  : "Registra una deuda que le debas a alguien."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 gap-1.5"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="h-4 w-4" />
                Nueva deuda
              </Button>
            </div>
          ) : (
            <div className="overflow-y-auto lg:min-h-0 lg:flex-1">
              {summary.map((person) => {
                const expenses = getExpensesForPerson(person.name);

                return (
                  <div key={person.name}>
                    {/* La persona queda pegada arriba mientras scrolleás
                        sus gastos — la misma gramática que los días en
                        Inicio. */}
                    <div className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-border bg-card px-4 py-2 md:px-5">
                      <div
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full",
                          isOwedToMe ? "bg-primary/10" : "bg-destructive/10"
                        )}
                      >
                        <span
                          className={cn(
                            "text-[11px] font-bold",
                            isOwedToMe ? "text-primary" : "text-destructive"
                          )}
                        >
                          {person.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <p className="min-w-0 flex-1 truncate text-xs font-semibold">
                        {person.name}
                      </p>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                        {person.count_expenses}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-sm font-bold tabular-nums",
                          isOwedToMe ? "text-warning" : "text-destructive",
                          isPrivacyMode && "privacy-blur"
                        )}
                      >
                        {fmt(person.total_owed)}
                      </span>
                    </div>

                    {expenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center gap-2 border-b border-border px-4 py-2 transition-colors hover:bg-muted md:px-5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs">
                            {expense.transaction_detail || expense.detail || "Sin detalle"}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                            {expense.transaction_date
                              ? new Date(expense.transaction_date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })
                              : new Date(expense.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                            {expense.transaction_category && (
                              <>
                                {" · "}
                                {expense.transaction_category}
                              </>
                            )}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 font-mono text-xs font-medium tabular-nums",
                            isPrivacyMode && "privacy-blur"
                          )}
                        >
                          {fmt(expense.amount_owed)}
                        </span>
                        {/* Botones de ícono: círculos de verdad, siguen
                            redondos. */}
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-success/10 active:bg-success/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title={isOwedToMe ? "Marcar como pagado" : "Marcar como saldada"}
                            onClick={() =>
                              isOwedToMe
                                ? setConfirmPaid({
                                  id: expense.id,
                                  name: expense.debtor_name,
                                  amount: expense.amount_owed,
                                  detail: expense.transaction_detail || undefined,
                                })
                                : setSettleTarget({
                                  id: expense.id,
                                  name: expense.debtor_name,
                                  amount: expense.amount_owed,
                                })
                            }
                          >
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          </button>
                          <button
                            className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-destructive/10 active:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Eliminar"
                            onClick={() => setConfirmDelete({ open: true, id: expense.id })}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground transition-colors hover:text-destructive" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </Screen>

      {/* ── ABAJO DEL PLIEGUE — el archivo de lo ya saldado ──────── */}
      {paidExpenses.length > 0 && (
        <div className="grid gap-px border-b border-border bg-border">
          <Panel>
            <button
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-5"
              onClick={() => setShowPaid(!showPaid)}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  showPaid && "rotate-180"
                )}
              />
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              <h2 className="section-title text-xs">
                {isOwedToMe ? "Pagados" : "Saldadas"}
              </h2>
              <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
                {paidExpenses.length}
              </span>
            </button>

            {showPaid && (
              <div className="border-t border-border">
                {paidExpenses.slice(0, 15).map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center gap-2.5 border-b border-border px-4 py-2 text-xs text-muted-foreground transition-colors last:border-b-0 hover:bg-muted md:px-5"
                  >
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success/10">
                      <span className="text-[10px] font-bold text-success">
                        {expense.debtor_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-foreground">
                        {expense.debtor_name}
                      </span>
                      <span className="mx-1.5">·</span>
                      <span>
                        {expense.transaction_detail || expense.detail || "Sin detalle"}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 font-mono tabular-nums",
                        isPrivacyMode && "privacy-blur"
                      )}
                    >
                      {fmt(expense.amount_owed)}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums">
                      {new Date(expense.paid_at!).toLocaleDateString("es-CL", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Quick Add Debt Modal */}
      <BaseModal
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open);
          if (!open) setNewDebt({ name: "", amount: "", detail: "" });
        }}
        title="Nueva deuda"
        maxWidth="sm"
        variant="expense"
        footer={
          <Button
            variant="destructive"
            size="cta"
            onClick={handleAddDebt}
            disabled={
              !newDebt.name.trim() ||
              !newDebt.amount ||
              parseRawAmount(newDebt.amount) <= 0 ||
              addQuickDebt.isPending ||
              addManualDebtIOwe.isPending
            }
          >
            Crear deuda
          </Button>
        }
      >
        <div className="space-y-5">
          {/* El mismo conmutador de la página: dos celdas separadas por
              la línea, y la activa es el bloque de acento. */}
          <div className="grid grid-cols-2 gap-px border border-border bg-border">
            <button
              type="button"
              className={cn(
                "bg-card px-4 py-2 text-sm font-medium transition-colors",
                direction === "they_owe_me"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setDirection("they_owe_me")}
            >
              Me deben
            </button>
            <button
              type="button"
              className={cn(
                "bg-card px-4 py-2 text-sm font-medium transition-colors",
                direction === "i_owe_them"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setDirection("i_owe_them")}
            >
              Yo debo
            </button>
          </div>

          {/* Big amount input - Rindo style */}
          <div>
            <Input
              ref={amountInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="$0"
              value={newDebt.amount}
              onChange={(e) =>
                setNewDebt({ ...newDebt, amount: formatCurrency(e.target.value) })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddDebt();
              }}
              style={{ fontSize: "clamp(1.5rem, 5vw, 2.25rem)" }}
              className="h-24 rounded-sm border-2 border-destructive bg-transparent text-center font-mono font-bold transition-all placeholder:text-muted-foreground/50 focus-visible:ring-transparent"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              {direction === "they_owe_me" ? "Nombre" : "¿A quién le debes?"}
            </Label>
            <DebtorNameCombobox
              placeholder="ej. Juan"
              value={newDebt.name}
              onChange={(name) => setNewDebt({ ...newDebt, name })}
              suggestions={uniqueDebtorNames(direction)}
              className="h-11 rounded-sm px-5"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Detalle <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              placeholder="ej. Cena del viernes"
              value={newDebt.detail}
              onChange={(e) => setNewDebt({ ...newDebt, detail: e.target.value })}
              className="h-11 rounded-sm px-5"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddDebt();
              }}
            />
          </div>
        </div>
      </BaseModal>

      {/* Confirm Paid Dialog (they_owe_me) */}
      <ConfirmDialog
        open={!!confirmPaid}
        onOpenChange={() => setConfirmPaid(null)}
        onConfirm={handleMarkAsPaid}
        title="Confirmar pago"
        description={
          confirmPaid
            ? `Se registrará el pago de ${fmt(confirmPaid.amount)} de ${confirmPaid.name}.`
            : ""
        }
        confirmText="Pagado"
        cancelText="Cancelar"
        variant="default"
      />

      {/* Settle with existing Gasto (i_owe_them) */}
      <BaseModal
        open={!!settleTarget}
        onOpenChange={(open) => !open && setSettleTarget(null)}
        title="Saldar deuda"
        maxWidth="sm"
      >
        <div className="space-y-4">
          {settleTarget && (
            <p className="text-sm text-muted-foreground">
              Elige el gasto con el que le pagaste {fmt(settleTarget.amount)} a {settleTarget.name}.
            </p>
          )}
          <div className="max-h-[320px] overflow-y-auto border border-border">
            {recentGastos.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No tienes gastos registrados todavía.
              </p>
            )}
            {recentGastos.map((tx) => (
              <button
                key={tx.id}
                type="button"
                disabled={settleDebtsIOwe.isPending}
                onClick={() => handleSettleWithTransaction(tx.id)}
                className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <HandCoins className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tx.detail || "Sin detalle"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })} · {tx.category_name}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold shrink-0">{fmt(tx.amount)}</span>
              </button>
            ))}
          </div>
        </div>
      </BaseModal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: null })}
        onConfirm={handleConfirmDelete}
        title="Eliminar deuda"
        description="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </Layout>
  );
}
