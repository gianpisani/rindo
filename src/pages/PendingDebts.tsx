import { useState, useRef, useEffect, useMemo } from "react";
import Layout from "@/components/Layout";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BaseModal } from "@/components/BaseModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { DebtorNameCombobox } from "@/components/DebtorNameCombobox";
import { DebtLinkPanel } from "@/components/DebtLinkPanel";
import { useSharedExpenses, type SharedExpenseDirection } from "@/hooks/useSharedExpenses";
import { useTransactions } from "@/hooks/useTransactions";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { cn } from "@/lib/utils";
import { fmt, formatCurrencyInput, parseRawAmount } from "@/lib/currency";
import {
  groupByPerson,
  planFromSelection,
  planNetSettlement,
  type PersonDebts,
} from "@/lib/debtNetting";
import { toast } from "sonner";
import {
  Plus,
  CheckCircle2,
  Trash2,
  Users,
  ChevronDown,
  DollarSign,
  Receipt,
  HandCoins,
  ArrowLeftRight,
} from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";

/** Filtro de la lista. 'all' es el modo por defecto: la deuda se lee por persona. */
type DebtFilter = "all" | SharedExpenseDirection;

export default function PendingDebts() {
  const {
    sharedExpensesWithTransaction,
    markAsPaid,
    settleShared,
    settleDebtsIOwe,
    deleteSharedExpense,
    addQuickDebt,
    addManualDebtIOwe,
    uniqueDebtorNames,
    isLoading,
  } = useSharedExpenses();
  const { transactions } = useTransactions();
  const { isPrivacyMode } = usePrivacyMode();

  const [filter, setFilter] = useState<DebtFilter>("all");

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newDebt, setNewDebt] = useState({ name: "", amount: "", detail: "" });
  // Propio del modal: cambiar la dirección de la deuda que estás creando no debe
  // cambiar el filtro de la lista que quedó atrás.
  const [newDebtDirection, setNewDebtDirection] = useState<SharedExpenseDirection>("they_owe_me");
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Saldar el neto de una persona: qué deudas se cierran y con qué transacción.
  const [netTarget, setNetTarget] = useState<PersonDebts | null>(null);
  const [netSelection, setNetSelection] = useState<string[]>([]);

  // Focus amount input when modal opens
  useEffect(() => {
    if (showAddModal) {
      setTimeout(() => amountInputRef.current?.focus(), 100);
    }
  }, [showAddModal]);

  const pending = useMemo(
    () => sharedExpensesWithTransaction.filter((exp) => !exp.paid),
    [sharedExpensesWithTransaction]
  );

  // La agrupación se hace acá y no con get_balances_by_person porque la lista
  // también necesita las filas individuales, y así el neto que se muestra sale
  // exactamente de las mismas deudas que se van a cerrar.
  const people = useMemo(() => {
    const grouped = groupByPerson(pending);
    if (filter === "all") return grouped;
    return grouped.filter((p) =>
      filter === "they_owe_me" ? p.owedToMe.length > 0 : p.iOwe.length > 0
    );
  }, [pending, filter]);

  const totals = useMemo(
    () =>
      people.reduce(
        (acc, p) => ({
          owedToMe: acc.owedToMe + p.owedToMeTotal,
          iOwe: acc.iOwe + p.iOweTotal,
          count: acc.count + p.owedToMe.length + p.iOwe.length,
        }),
        { owedToMe: 0, iOwe: 0, count: 0 }
      ),
    [people]
  );
  const net = totals.owedToMe - totals.iOwe;

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
    if (newDebtDirection === "they_owe_me") {
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

  const openNetModal = (person: PersonDebts) => {
    const plan = planNetSettlement(person);
    setNetTarget(person);
    setNetSelection([...plan.cashIds, ...plan.offsetIds]);
  };

  const netPlan = useMemo(
    () => planFromSelection(pending.filter((r) => netSelection.includes(r.id))),
    [pending, netSelection]
  );

  /** Compensación pura: no hubo transferencia, así que no hay nada que vincular. */
  const handleCompensateOnly = async () => {
    try {
      await settleShared.mutateAsync({
        cashIds: netPlan.cashIds,
        offsetIds: netPlan.offsetIds,
        transactionId: null,
      });
      toast.success("Deudas compensadas");
      setNetTarget(null);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSettleNetWith = async (transactionId: string) => {
    try {
      await settleShared.mutateAsync({
        cashIds: netPlan.cashIds,
        offsetIds: netPlan.offsetIds,
        transactionId,
      });
      toast.success(netTarget ? `Cuentas saldadas con ${netTarget.displayName}` : "Cuentas saldadas");
      setNetTarget(null);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Candidatas para vincular el neto: un Gasto si tengo que pagar yo, un ingreso
  // si me pagaron a mí.
  const candidateTransactions = useMemo(() => {
    const wanted =
      netPlan.netDirection === "out" ? ["Gasto"] : ["Ingreso", "Reembolso"];
    return transactions.filter((t) => wanted.includes(t.type)).slice(0, 30);
  }, [transactions, netPlan.netDirection]);

  const recentGastos = useMemo(
    () => transactions.filter((t) => t.type === "Gasto").slice(0, 30),
    [transactions]
  );

  const settledExpenses = sharedExpensesWithTransaction.filter((exp) => exp.paid);

  if (isLoading) {
    return (
      <Layout>
        <LoadingScreen fullScreen={false} size="md" />
      </Layout>
    );
  }

  const filters: Array<{ value: DebtFilter; label: string }> = [
    { value: "all", label: "Todos" },
    { value: "they_owe_me", label: "Me deben" },
    { value: "i_owe_them", label: "Yo debo" },
  ];

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

        {/* Filtro */}
        <div className="inline-flex rounded-full border border-border/60 p-1 bg-muted/30">
          {filters.map((f) => (
            <button
              key={f.value}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                filter === f.value ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              )}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        {people.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5 text-amber-500">
              <DollarSign className="h-4 w-4" />
              <span className={cn("font-semibold tabular-nums", isPrivacyMode && "privacy-blur")}>
                {fmt(totals.owedToMe)}
              </span>
              <span className="text-muted-foreground">a favor</span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5 text-destructive">
              <span className={cn("font-semibold tabular-nums", isPrivacyMode && "privacy-blur")}>
                {fmt(totals.iOwe)}
              </span>
              <span className="text-muted-foreground">en contra</span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">neto</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  net > 0 ? "text-amber-500" : net < 0 ? "text-destructive" : "text-success",
                  isPrivacyMode && "privacy-blur"
                )}
              >
                {fmt(Math.abs(net))}
              </span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span className="tabular-nums">{people.length}</span>
              <Receipt className="h-3.5 w-3.5 ml-2" />
              <span className="tabular-nums">{totals.count}</span>
            </div>
          </div>
        )}

        {/* Lista por persona */}
        {people.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-base font-medium text-muted-foreground mb-1">
              {filter === "all"
                ? "Estás al día con todos"
                : filter === "they_owe_me"
                  ? "No hay deudas pendientes"
                  : "No le debes plata a nadie"}
            </p>
            <p className="text-sm text-muted-foreground/60 mb-4">
              {filter === "i_owe_them"
                ? "Registra una deuda que le debas a alguien"
                : "Agrega una deuda o divide un gasto compartido"}
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
            {people.map((person) => {
              const isExpanded = expanded[person.key] ?? false;
              // Con el filtro puesto sólo se listan las deudas de ese lado, pero
              // el neto sigue siendo el de la persona completa.
              const visibleRows =
                filter === "they_owe_me"
                  ? person.owedToMe
                  : filter === "i_owe_them"
                    ? person.iOwe
                    : [...person.owedToMe, ...person.iOwe];

              return (
                <GlassCard key={person.key}>
                  {/* Encabezado de la persona */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div
                      className={cn(
                        "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                        person.net > 0
                          ? "bg-primary/10"
                          : person.net < 0
                            ? "bg-destructive/10"
                            : "bg-success/10"
                      )}
                    >
                      <span
                        className={cn(
                          "text-sm font-bold",
                          person.net > 0
                            ? "text-primary"
                            : person.net < 0
                              ? "text-destructive"
                              : "text-success"
                        )}
                      >
                        {person.displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{person.displayName}</p>
                      {person.hasBothSides ? (
                        <p className={cn("text-xs text-muted-foreground", isPrivacyMode && "privacy-blur")}>
                          te debe {fmt(person.owedToMeTotal)} · le debes {fmt(person.iOweTotal)}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {visibleRows.length} {visibleRows.length === 1 ? "gasto" : "gastos"}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-muted-foreground">
                        {person.net > 0 ? "Te debe" : person.net < 0 ? "Le debes" : "Al día"}
                      </p>
                      <span
                        className={cn(
                          "text-base font-bold tabular-nums",
                          person.net > 0
                            ? "text-amber-500"
                            : person.net < 0
                              ? "text-destructive"
                              : "text-success",
                          isPrivacyMode && "privacy-blur"
                        )}
                      >
                        {fmt(Math.abs(person.net))}
                      </span>
                    </div>
                  </div>

                  {/* Compensación disponible + acciones */}
                  <div className="flex items-center gap-2 px-4 pb-3">
                    {person.offsetAmount > 0 && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success",
                          isPrivacyMode && "privacy-blur"
                        )}
                      >
                        <ArrowLeftRight className="h-3 w-3" />
                        se compensan {fmt(person.offsetAmount)}
                      </span>
                    )}
                    <div className="flex-1" />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full text-xs"
                      onClick={() => openNetModal(person)}
                    >
                      {person.net === 0 ? "Compensar" : "Saldar el neto"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 rounded-full text-xs"
                      onClick={() => setExpanded((prev) => ({ ...prev, [person.key]: !isExpanded }))}
                    >
                      Detalle
                      <ChevronDown className={cn("h-3.5 w-3.5 ml-1 transition-transform", isExpanded && "rotate-180")} />
                    </Button>
                  </div>

                  {/* Deudas individuales */}
                  {isExpanded && visibleRows.length > 0 && (
                    <div className="border-t border-border/40">
                      {visibleRows.map((expense, i) => {
                        const isOwedToMe = expense.direction === "they_owe_me";
                        return (
                          <div
                            key={expense.id}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2.5 hover:bg-accent/30 transition-colors",
                              i < visibleRows.length - 1 && "border-b border-border/20"
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full shrink-0",
                                isOwedToMe ? "bg-amber-500" : "bg-destructive"
                              )}
                              aria-hidden
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">
                                {expense.transaction_detail || expense.detail || "Sin detalle"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(
                                  expense.transaction_date || expense.created_at
                                ).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                                {expense.transaction_category && ` · ${expense.transaction_category}`}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "text-sm font-medium tabular-nums shrink-0",
                                isOwedToMe ? "text-amber-500" : "text-destructive",
                                isPrivacyMode && "privacy-blur"
                              )}
                            >
                              {isOwedToMe ? fmt(expense.amount_owed) : `-${fmt(expense.amount_owed)}`}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-success/10 active:bg-success/20 transition-colors"
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
                        );
                      })}
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        )}

        {/* Historial */}
        {settledExpenses.length > 0 && (
          <div>
            <button
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
              onClick={() => setShowPaid(!showPaid)}
            >
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", showPaid && "rotate-180")}
              />
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>Saldadas ({settledExpenses.length})</span>
            </button>

            {showPaid && (
              <div className="space-y-1">
                {settledExpenses.slice(0, 15).map((expense) => {
                  // settlement_kind viene null en las deudas cerradas antes de que
                  // existiera la columna: esas se leen como pagadas con plata.
                  const wasOffset = expense.settlement_kind === "offset";
                  return (
                    <div
                      key={expense.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
                    >
                      <div
                        className={cn(
                          "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                          wasOffset ? "bg-info/10" : "bg-success/10"
                        )}
                      >
                        {wasOffset ? (
                          <ArrowLeftRight className="h-3.5 w-3.5 text-info" />
                        ) : (
                          <span className="text-xs font-bold text-success">
                            {expense.debtor_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 truncate">
                        <span>{expense.debtor_name}</span>
                        <span className="mx-1.5">·</span>
                        <span className="text-xs">
                          {expense.transaction_detail || expense.detail || "Sin detalle"}
                        </span>
                        {wasOffset && (
                          <span className="ml-1.5 text-[11px] text-info">Compensada</span>
                        )}
                      </div>
                      <span
                        className={cn("tabular-nums text-xs shrink-0", isPrivacyMode && "privacy-blur")}
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
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Saldar el neto con una persona */}
      <BaseModal
        open={!!netTarget}
        onOpenChange={(open) => {
          if (!open) {
            setNetTarget(null);
            setNetSelection([]);
          }
        }}
        title={netTarget ? `Saldar con ${netTarget.displayName}` : "Saldar"}
        maxWidth="md"
      >
        {netTarget && (
          <div className="space-y-4">
            <DebtLinkPanel
              rows={pending}
              personKeyFilter={netTarget.key}
              selectedIds={netSelection}
              onSelectionChange={setNetSelection}
            />

            {netSelection.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Elige qué deudas quieres cerrar.
              </p>
            ) : netPlan.netDirection === "none" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Se compensan {fmt(netPlan.offsetAmount)} y quedan a mano. No se mueve plata, así que
                  no hay ninguna transacción que vincular.
                </p>
                <Button
                  className="w-full rounded-full"
                  disabled={settleShared.isPending}
                  onClick={handleCompensateOnly}
                >
                  Compensar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {netPlan.offsetAmount > 0 && `Se compensan ${fmt(netPlan.offsetAmount)}. `}
                  {netPlan.netDirection === "out"
                    ? `Elige el gasto con el que le pagaste ${fmt(netPlan.netAmount)} a ${netTarget.displayName}.`
                    : `Elige el ingreso con el que ${netTarget.displayName} te pagó ${fmt(netPlan.netAmount)}.`}
                </p>
                <div className="max-h-[280px] overflow-y-auto space-y-1.5">
                  {candidateTransactions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No tienes transacciones de ese tipo todavía.
                    </p>
                  )}
                  {candidateTransactions.map((tx) => (
                    <button
                      key={tx.id}
                      type="button"
                      disabled={settleShared.isPending}
                      onClick={() => handleSettleNetWith(tx.id)}
                      className="w-full flex items-center justify-between rounded-lg border border-border bg-background p-3 gap-3 text-left hover:border-primary/40 hover:bg-accent/30 transition-colors"
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
                      <span className="text-sm font-semibold shrink-0 tabular-nums">{fmt(tx.amount)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </BaseModal>

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
              addQuickDebt.isPending ||
              addManualDebtIOwe.isPending
            }
          >
            Crear deuda
          </Button>
        }
      >
        <div className="space-y-5">
          {/* Dirección de la deuda que se está creando */}
          <div className="inline-flex w-full rounded-full border border-border/60 p-1 bg-muted/30">
            <button
              type="button"
              className={cn(
                "flex-1 px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                newDebtDirection === "they_owe_me" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              )}
              onClick={() => setNewDebtDirection("they_owe_me")}
            >
              Me deben
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                newDebtDirection === "i_owe_them" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              )}
              onClick={() => setNewDebtDirection("i_owe_them")}
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
                setNewDebt({ ...newDebt, amount: formatCurrencyInput(e.target.value) })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddDebt();
              }}
              style={{ fontSize: "clamp(1.5rem, 5vw, 2.25rem)" }}
              className="h-24 text-center font-bold font-mono rounded-3xl border-2 border-destructive/30 focus:border-destructive focus:ring-4 focus:ring-destructive/20 transition-all bg-transparent placeholder:text-muted-foreground/50 focus-visible:ring-transparent"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              {newDebtDirection === "they_owe_me" ? "Nombre" : "¿A quién le debes?"}
            </Label>
            <DebtorNameCombobox
              placeholder="ej. Juan"
              value={newDebt.name}
              onChange={(name) => setNewDebt({ ...newDebt, name })}
              suggestions={uniqueDebtorNames(newDebtDirection)}
              className="h-11 rounded-full px-5"
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
          <div className="max-h-[320px] overflow-y-auto space-y-1.5">
            {recentGastos.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No tienes gastos registrados todavía.
              </p>
            )}
            {recentGastos.map((tx) => (
              <button
                key={tx.id}
                type="button"
                disabled={settleDebtsIOwe.isPending}
                onClick={() => handleSettleWithTransaction(tx.id)}
                className="w-full flex items-center justify-between rounded-lg border border-border bg-background p-3 gap-3 text-left hover:border-primary/40 hover:bg-accent/30 transition-colors"
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
