import { useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Layout from "@/components/Layout";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSharedExpenses, type SharedExpenseDirection } from "@/hooks/useSharedExpenses";
import { useTransactions } from "@/hooks/useTransactions";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { parseWhisper } from "@/lib/whisper";
import { cn } from "@/lib/utils";
import {
  Plus,
  CheckCircle2,
  Trash2,
  Users,
  ChevronDown,
  DollarSign,
  Receipt,
  HandCoins,
  ArrowUp,
  Check,
  X,
} from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import "@/components/whisper.css";

const fmt = (n: number) => `$${new Intl.NumberFormat("es-CL").format(n)}`;

/**
 * Nueva deuda al estilo Whisper: una línea con el monto y la persona
 * ("25000 Juan"), la dirección en la pastilla de arriba (me deben / yo debo),
 * los nombres frecuentes como pastillas y el detalle en "Más opciones".
 * Saldar deuda usa el mismo composer: una línea para buscar el gasto con el
 * que pagaste, y la lista abajo.
 */
const directions: { value: SharedExpenseDirection; label: string; color: string; placeholder: string }[] = [
  { value: "they_owe_me", label: "Me deben", color: "#4ade80", placeholder: "25000 Juan" },
  { value: "i_owe_them", label: "Yo debo", color: "#f87171", placeholder: "25000 Juan" },
];

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
  // La línea "monto nombre"; el nombre también se puede tocar en una pastilla.
  const [debtValue, setDebtValue] = useState("");
  const [pickedName, setPickedName] = useState("");
  const [debtDetail, setDebtDetail] = useState("");
  const [debtExpanded, setDebtExpanded] = useState(false);
  const [debtError, setDebtError] = useState("");
  const [settleQuery, setSettleQuery] = useState("");
  const savingDebt = useRef(false);
  const debtInputRef = useRef<HTMLInputElement>(null);
  const settleInputRef = useRef<HTMLInputElement>(null);

  const currentDirection = directions.find((d) => d.value === direction) ?? directions[0];
  const parsedDebt = parseWhisper(debtValue);
  const debtName = (parsedDebt?.detail ?? "").trim() || pickedName;
  const debtReady = !!parsedDebt && debtName.length > 0;
  const suggestedNames = uniqueDebtorNames(direction);

  const resetDebt = () => {
    setDebtValue("");
    setPickedName("");
    setDebtDetail("");
    setDebtExpanded(false);
    setDebtError("");
  };

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

  const handleAddDebt = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (savingDebt.current) return;
    if (!parsedDebt) {
      setDebtError("Escribe el monto en pesos, seguido de la persona.");
      debtInputRef.current?.focus();
      return;
    }
    if (!debtName) {
      setDebtError(isOwedToMe ? "¿Quién te debe? Escribe el nombre después del monto." : "¿A quién le debes? Escribe el nombre después del monto.");
      debtInputRef.current?.focus();
      return;
    }
    savingDebt.current = true;
    try {
      const detail = debtDetail.trim() || undefined;
      if (direction === "they_owe_me") {
        await addQuickDebt.mutateAsync({ debtorName: debtName, amount: parsedDebt.amount, detail });
      } else {
        await addManualDebtIOwe.mutateAsync({ creditorName: debtName, amount: parsedDebt.amount, detail });
      }
      resetDebt();
      setShowAddModal(false);
    } catch {
      setDebtError("No se guardó la deuda. Intenta de nuevo.");
    } finally {
      savingDebt.current = false;
    }
  };

  const cycleDirection = (backwards: boolean) => {
    const index = directions.indexOf(currentDirection);
    setDirection(directions[(index + (backwards ? directions.length - 1 : 1)) % directions.length].value);
    setPickedName("");
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

  const recentGastos = useMemo(() => {
    const query = settleQuery.trim().toLowerCase();
    return transactions
      .filter((t) => t.type === "Gasto")
      .filter((t) => !query || `${t.detail ?? ""} ${t.category_name ?? ""}`.toLowerCase().includes(query))
      .slice(0, 30);
  }, [transactions, settleQuery]);

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

        {/* Direction toggle */}
        <div className="inline-flex rounded-full border border-border/60 p-1 bg-muted/30">
          <button
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              isOwedToMe ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            )}
            onClick={() => setDirection("they_owe_me")}
          >
            Me deben
          </button>
          <button
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              !isOwedToMe ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            )}
            onClick={() => setDirection("i_owe_them")}
          >
            Yo debo
          </button>
        </div>

        {/* Compact Stats Row */}
        {summary.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <div className={cn("flex items-center gap-1.5", isOwedToMe ? "text-amber-500" : "text-destructive")}>
              <DollarSign className="h-4 w-4" />
              <span className={cn("font-semibold tabular-nums", isPrivacyMode && "privacy-blur")}>
                {fmt(totalPending)}
              </span>
              <span className="text-muted-foreground">pendiente</span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span className="tabular-nums">{summary.length}</span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" />
              <span className="tabular-nums">{totalExpenses}</span>
            </div>
          </div>
        )}

        {/* Pending Debts - Flat List by Person */}
        {summary.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-base font-medium text-muted-foreground mb-1">
              {isOwedToMe ? "No hay deudas pendientes" : "No le debes plata a nadie"}
            </p>
            <p className="text-sm text-muted-foreground/60 mb-4">
              {isOwedToMe ? "Agrega una deuda o divide un gasto compartido" : "Registra una deuda que le debas a alguien"}
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
            {summary.map((person) => {
              const expenses = getExpensesForPerson(person.name);

              return (
                <GlassCard key={person.name}>
                  {/* Person Header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0", isOwedToMe ? "bg-primary/10" : "bg-destructive/10")}>
                      <span className={cn("text-sm font-bold", isOwedToMe ? "text-primary" : "text-destructive")}>
                        {person.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {person.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {person.count_expenses}{" "}
                        {person.count_expenses === 1 ? "gasto" : "gastos"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-base font-bold tabular-nums",
                        isOwedToMe ? "text-amber-500" : "text-destructive",
                        isPrivacyMode && "privacy-blur"
                      )}
                    >
                      {fmt(person.total_owed)}
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
                              {expense.transaction_detail || expense.detail || "Sin detalle"}
                            </p>
                            <p className="text-xs text-muted-foreground">
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
              <span>{isOwedToMe ? "Pagados" : "Saldadas"} ({paidExpenses.length})</span>
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
                        {expense.transaction_detail || expense.detail || "Sin detalle"}
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

      {/* Nueva deuda: el composer */}
      <Dialog.Root
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open);
          if (!open) resetDebt();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="whisper-backdrop" />
          <Dialog.Content
            data-scrollable
            className="whisper-composer"
            style={{ "--whisper-accent": currentDirection.color } as React.CSSProperties}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              debtInputRef.current?.focus();
            }}
          >
            <Dialog.Title className="sr-only">Nueva deuda</Dialog.Title>
            <Dialog.Description className="sr-only">
              Escribe el monto y el nombre de la persona en una línea. Tab cambia entre me deben y yo debo. Abajo puedes tocar un nombre frecuente y, en más opciones, agregar un detalle.
            </Dialog.Description>
            <Dialog.Close className="whisper-close" aria-label="Cerrar">
              <X size={16} />
            </Dialog.Close>

            <form onSubmit={handleAddDebt} className="whisper-form">
              <div className="whisper-type">
                <span className="whisper-dot" aria-hidden="true" />
                <span aria-hidden="true">{currentDirection.label}</span>
                <select
                  aria-label="Dirección de la deuda"
                  value={direction}
                  onChange={(event) => {
                    setDirection(event.target.value as SharedExpenseDirection);
                    setPickedName("");
                    debtInputRef.current?.focus();
                  }}
                >
                  {directions.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} aria-hidden="true" />
              </div>

              <div className="whisper-entry">
                <input
                  ref={debtInputRef}
                  aria-label="Monto y persona"
                  aria-describedby={debtError ? "debt-error debt-shortcuts" : "debt-shortcuts"}
                  aria-invalid={!!debtError}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={200}
                  value={debtValue}
                  onChange={(event) => {
                    setDebtValue(event.target.value);
                    setDebtError("");
                  }}
                  placeholder={currentDirection.placeholder}
                  className={cn("whisper-input", isPrivacyMode && debtValue && "privacy-blur")}
                  onKeyDown={(event) => {
                    if (event.nativeEvent.isComposing) return;
                    if (event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey) {
                      event.preventDefault();
                      cycleDirection(event.shiftKey);
                    }
                  }}
                />
                <div className={cn("whisper-preview", isPrivacyMode && parsedDebt && "privacy-blur")} aria-hidden="true">
                  {parsedDebt && <span>{fmt(parsedDebt.amount)}</span>}
                </div>
              </div>

              <div className="whisper-category-space">
                {suggestedNames.length > 0 && (
                  <div className="whisper-categories" role="group" aria-label="Personas frecuentes">
                    {suggestedNames.slice(0, 8).map((name) => {
                      const pressed = debtName.toLowerCase() === name.toLowerCase();
                      return (
                        <button
                          key={name}
                          type="button"
                          className="whisper-category"
                          aria-pressed={pressed}
                          onClick={() => {
                            // Si ya hay un nombre escrito en la línea, la pastilla lo reemplaza.
                            const amountPart = debtValue.trim().match(/^\$?\s*[\d.,]+/)?.[0] ?? "";
                            setPickedName(pressed ? "" : name);
                            setDebtValue(pressed ? amountPart.trim() : amountPart ? `${amountPart.trim()} ${name}` : "");
                            setDebtError("");
                            debtInputRef.current?.focus();
                          }}
                        >
                          <span className="whisper-category-dot" aria-hidden="true" />
                          {name}
                          {pressed && <Check size={12} aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="whisper-caption" aria-live="polite">
                  {debtName
                    ? isOwedToMe
                      ? `${debtName} te debe${parsedDebt ? ` ${fmt(parsedDebt.amount)}` : ""}`
                      : `Le debes${parsedDebt ? ` ${fmt(parsedDebt.amount)}` : ""} a ${debtName}`
                    : isOwedToMe
                    ? "El nombre va después del monto"
                    : "¿A quién le debes? Va después del monto"}
                  {debtDetail.trim() && ` · ${debtDetail.trim()}`}
                </p>
              </div>

              {debtExpanded && (
                <div className="whisper-options whisper-debt-options">
                  <label>
                    Detalle
                    <input
                      value={debtDetail}
                      onChange={(event) => setDebtDetail(event.target.value)}
                      placeholder="Cena del viernes"
                      aria-label="Detalle de la deuda"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleAddDebt();
                        }
                      }}
                    />
                  </label>
                </div>
              )}

              {debtError && (
                <p id="debt-error" role="alert" className="whisper-error">
                  {debtError}
                </p>
              )}

              <div className="whisper-actions">
                <button type="button" className="whisper-options-toggle" aria-expanded={debtExpanded} onClick={() => setDebtExpanded(!debtExpanded)}>
                  {debtExpanded ? "Menos opciones" : "Más opciones"}
                  <ChevronDown size={12} className={cn(debtExpanded && "rotate-180")} />
                </button>
                <button
                  type="submit"
                  className="whisper-submit"
                  disabled={!debtReady || addQuickDebt.isPending || addManualDebtIOwe.isPending}
                  aria-label="Crear deuda"
                >
                  Crear deuda
                  <span className="hidden sm:inline" aria-hidden="true">↵</span>
                  <ArrowUp size={14} className="sm:hidden" aria-hidden="true" />
                </button>
              </div>
              <p id="debt-shortcuts" className="whisper-shortcuts">
                <span>
                  <kbd>Tab</kbd> me deben / yo debo
                </span>
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

      {/* Saldar deuda: elegir el gasto con el que pagaste, en el mismo composer */}
      <Dialog.Root
        open={!!settleTarget}
        onOpenChange={(open) => {
          if (!open) {
            setSettleTarget(null);
            setSettleQuery("");
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="whisper-backdrop" />
          <Dialog.Content
            data-scrollable
            className="whisper-composer"
            style={{ "--whisper-accent": "#f87171" } as React.CSSProperties}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              settleInputRef.current?.focus();
            }}
          >
            <Dialog.Title className="sr-only">Saldar deuda</Dialog.Title>
            <Dialog.Description className="sr-only">
              Elige el gasto con el que pagaste esta deuda. Puedes escribir para buscar entre tus últimos gastos.
            </Dialog.Description>
            <Dialog.Close className="whisper-close" aria-label="Cerrar">
              <X size={16} />
            </Dialog.Close>

            <div className="whisper-form">
              <div className="whisper-type" data-static>
                <span className="whisper-dot" aria-hidden="true" />
                <span>Saldar deuda</span>
              </div>

              <div className="whisper-entry">
                <input
                  ref={settleInputRef}
                  aria-label="Buscar el gasto con el que pagaste"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={settleQuery}
                  onChange={(event) => setSettleQuery(event.target.value)}
                  placeholder="Buscar gasto"
                  className="whisper-input whisper-debt-search"
                />
                <div className={cn("whisper-preview", isPrivacyMode && "privacy-blur")} aria-hidden="true">
                  {settleTarget && (
                    <span>
                      le pagaste {fmt(settleTarget.amount)} a {settleTarget.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="whisper-debt-list" role="listbox" aria-label="Últimos gastos">
                {recentGastos.length === 0 && (
                  <p className="whisper-caption">
                    {settleQuery.trim() ? "Ningún gasto calza con eso." : "No tienes gastos registrados todavía."}
                  </p>
                )}
                {recentGastos.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    disabled={settleDebtsIOwe.isPending}
                    onClick={() => handleSettleWithTransaction(tx.id)}
                    className="whisper-debt-row"
                  >
                    <HandCoins size={14} aria-hidden="true" />
                    <span className="whisper-debt-row-main">
                      <span className={cn("whisper-debt-row-detail", isPrivacyMode && "privacy-blur")}>{tx.detail || "Sin detalle"}</span>
                      <span className="whisper-debt-row-meta">
                        {new Date(tx.date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })} · {tx.category_name}
                      </span>
                    </span>
                    <span className={cn("whisper-debt-row-amount", isPrivacyMode && "privacy-blur")}>{fmt(tx.amount)}</span>
                  </button>
                ))}
              </div>

              <p className="whisper-shortcuts">
                <span>
                  <kbd>Esc</kbd> cerrar
                </span>
              </p>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

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
