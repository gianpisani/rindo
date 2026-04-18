import { useState, useRef, useEffect } from "react";
import Layout from "@/components/Layout";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BaseModal } from "@/components/BaseModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSharedExpenses } from "@/hooks/useSharedExpenses";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { cn } from "@/lib/utils";
import {
  Plus,
  CheckCircle2,
  Trash2,
  Users,
  ChevronDown,
  DollarSign,
  Receipt,
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
    sharedExpensesWithTransaction,
    markAsPaid,
    deleteSharedExpense,
    addQuickDebt,
    isLoading,
  } = useSharedExpenses();
  const { isPrivacyMode } = usePrivacyMode();

  const [confirmPaid, setConfirmPaid] = useState<{
    id: string;
    name: string;
    amount: number;
    detail?: string;
  } | null>(null);
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

  const handleConfirmDelete = async () => {
    if (confirmDelete.id) {
      await deleteSharedExpense.mutateAsync(confirmDelete.id);
    }
  };

  const handleAddDebt = async () => {
    const amount = parseRawAmount(newDebt.amount);
    if (!newDebt.name.trim() || !amount || amount <= 0) return;
    await addQuickDebt.mutateAsync({
      debtorName: newDebt.name.trim(),
      amount,
      detail: newDebt.detail.trim() || undefined,
    });
    setNewDebt({ name: "", amount: "", detail: "" });
    setShowAddModal(false);
  };

  const getExpensesForDebtor = (debtorName: string) =>
    sharedExpensesWithTransaction.filter(
      (exp) => exp.debtor_name === debtorName && !exp.paid
    );

  const paidExpenses = sharedExpensesWithTransaction.filter((exp) => exp.paid);

  const totalPending = pendingByDebtor.reduce((s, d) => s + d.total_owed, 0);
  const totalExpenses = pendingByDebtor.reduce((s, d) => s + d.count_expenses, 0);

  if (isLoading) {
    return (
      <Layout>
        <LoadingScreen fullScreen={false} size="md" />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Deudas</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona gastos compartidos
            </p>
          </div>
          <Button
            className="rounded-full h-10 w-10 p-0 md:w-auto md:px-5 md:h-10"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline text-sm">Nueva deuda</span>
          </Button>
        </div>

        {/* Compact Stats Row */}
        {pendingByDebtor.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-amber-500">
              <DollarSign className="h-4 w-4" />
              <span className={cn("font-semibold tabular-nums", isPrivacyMode && "privacy-blur")}>
                {fmt(totalPending)}
              </span>
              <span className="text-muted-foreground">pendiente</span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span className="tabular-nums">{pendingByDebtor.length}</span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" />
              <span className="tabular-nums">{totalExpenses}</span>
            </div>
          </div>
        )}

        {/* Pending Debts - Flat List by Person */}
        {pendingByDebtor.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-base font-medium text-muted-foreground mb-1">
              No hay deudas pendientes
            </p>
            <p className="text-sm text-muted-foreground/60 mb-4">
              Agrega una deuda o divide un gasto compartido
            </p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nueva deuda
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingByDebtor.map((debtor) => {
              const expenses = getExpensesForDebtor(debtor.debtor_name);

              return (
                <GlassCard key={debtor.debtor_name}>
                  {/* Person Header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {debtor.debtor_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {debtor.debtor_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {debtor.count_expenses}{" "}
                        {debtor.count_expenses === 1 ? "gasto" : "gastos"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-base font-bold text-amber-500 tabular-nums",
                        isPrivacyMode && "privacy-blur"
                      )}
                    >
                      {fmt(debtor.total_owed)}
                    </span>
                  </div>

                  {/* Individual expenses */}
                  {expenses.length > 0 && (
                    <div className="border-t border-border/40">
                      {expenses.map((expense, i) => (
                        <div
                          key={expense.id}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2.5 hover:bg-accent/30 transition-colors",
                            i < expenses.length - 1 && "border-b border-border/20"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">
                              {expense.transaction_detail || "Sin detalle"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(expense.transaction_date).toLocaleDateString(
                                "es-CL",
                                { day: "numeric", month: "short" }
                              )}
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
                              "text-sm font-medium tabular-nums shrink-0",
                              isPrivacyMode && "privacy-blur"
                            )}
                          >
                            {fmt(expense.amount_owed)}
                          </span>
                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-success/10 active:bg-success/20 transition-colors"
                              title="Marcar como pagado"
                              onClick={() =>
                                setConfirmPaid({
                                  id: expense.id,
                                  name: expense.debtor_name,
                                  amount: expense.amount_owed,
                                  detail: expense.transaction_detail || undefined,
                                })
                              }
                            >
                              <CheckCircle2 className="h-[18px] w-[18px] text-success" />
                            </button>
                            <button
                              className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-destructive/10 active:bg-destructive/20 transition-colors"
                              title="Eliminar"
                              onClick={() => setConfirmDelete({ open: true, id: expense.id })}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        )}

        {/* Paid History */}
        {paidExpenses.length > 0 && (
          <div>
            <button
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
              onClick={() => setShowPaid(!showPaid)}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  showPaid && "rotate-180"
                )}
              />
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>Pagados ({paidExpenses.length})</span>
            </button>

            {showPaid && (
              <div className="space-y-1">
                {paidExpenses.slice(0, 15).map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
                  >
                    <div className="h-7 w-7 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-success">
                        {expense.debtor_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 truncate">
                      <span>
                        {expense.debtor_name}
                      </span>
                      <span className="mx-1.5">·</span>
                      <span className="text-xs">
                        {expense.transaction_detail || "Sin detalle"}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "tabular-nums text-xs shrink-0",
                        isPrivacyMode && "privacy-blur"
                      )}
                    >
                      {fmt(expense.amount_owed)}
                    </span>
                    <span className="text-xs shrink-0">
                      {new Date(expense.paid_at!).toLocaleDateString("es-CL", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
            className="w-full rounded-full bg-destructive hover:bg-destructive/90"
            onClick={handleAddDebt}
            disabled={
              !newDebt.name.trim() ||
              !newDebt.amount ||
              parseRawAmount(newDebt.amount) <= 0 ||
              addQuickDebt.isPending
            }
          >
            Crear deuda
          </Button>
        }
      >
        <div className="space-y-5">
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
              className="h-24 text-center font-bold font-mono rounded-3xl border-2 border-destructive/30 focus:border-destructive focus:ring-4 focus:ring-destructive/20 transition-all bg-transparent placeholder:text-muted-foreground/50 focus-visible:ring-transparent"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Nombre</Label>
            <Input
              placeholder="ej. Juan"
              value={newDebt.name}
              onChange={(e) => setNewDebt({ ...newDebt, name: e.target.value })}
              className="h-11 rounded-full px-5"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddDebt();
              }}
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
              className="h-11 rounded-full px-5"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddDebt();
              }}
            />
          </div>
        </div>
      </BaseModal>

      {/* Confirm Paid Dialog */}
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
