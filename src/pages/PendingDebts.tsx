import { useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Layout from "@/components/Layout";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  useSharedExpenses,
  type SharedExpenseDirection,
  type SharedExpenseWithTransaction,
} from "@/hooks/useSharedExpenses";
import { useTransactions } from "@/hooks/useTransactions";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { parseWhisper } from "@/lib/whisper";
import { cn } from "@/lib/utils";
import { Plus, CheckCircle2, Trash2, ChevronDown, HandCoins, ArrowUp, Check, X } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import "@/components/whisper.css";

const fmt = (n: number) => `$${new Intl.NumberFormat("es-CL").format(n)}`;
const shortDate = (d: string) => new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "short" });

type Debt = SharedExpenseWithTransaction;

/**
 * Deudas responde una pregunta: quién me debe, a quién le debo y cuánto.
 * Las dos direcciones van en la misma pantalla, cada persona con su total y
 * sus deudas abajo. Lo pagado queda detrás de un toque.
 */
const directions: { value: SharedExpenseDirection; label: string; color: string; amountClass: string }[] = [
  { value: "they_owe_me", label: "Me deben", color: "#4ade80", amountClass: "text-amber-500" },
  { value: "i_owe_them", label: "Yo debo", color: "#f87171", amountClass: "text-destructive" },
];

/** La carcasa común de los dos composers (nueva deuda y saldar deuda). */
function Composer({
  open,
  onClose,
  title,
  description,
  accent,
  focusRef,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  accent: string;
  focusRef: RefObject<HTMLInputElement>;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="whisper-backdrop" />
        <Dialog.Content
          data-scrollable
          className="whisper-composer"
          style={{ "--whisper-accent": accent } as React.CSSProperties}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusRef.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{description}</Dialog.Description>
          <Dialog.Close className="whisper-close" aria-label="Cerrar">
            <X size={16} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function PendingDebts() {
  const {
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

  // Marcar como pagada (me deben) o eliminar: un solo diálogo de confirmación.
  // El contenido se queda mientras el diálogo se cierra, para que no cambie en la animación.
  const [confirm, setConfirm] = useState<{ kind: "paid" | "delete"; debt: Debt } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState<Debt | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaid, setShowPaid] = useState(false);

  // Composer de nueva deuda: la línea "monto nombre"; el nombre también se puede tocar en una pastilla.
  const [direction, setDirection] = useState<SharedExpenseDirection>("they_owe_me");
  const [debtValue, setDebtValue] = useState("");
  const [pickedName, setPickedName] = useState("");
  const [debtDetail, setDebtDetail] = useState("");
  const [debtExpanded, setDebtExpanded] = useState(false);
  const [debtError, setDebtError] = useState("");
  const [settleQuery, setSettleQuery] = useState("");
  const savingDebt = useRef(false);
  const debtInputRef = useRef<HTMLInputElement>(null);
  const settleInputRef = useRef<HTMLInputElement>(null);

  const isOwedToMe = direction === "they_owe_me";
  const currentDirection = directions.find((d) => d.value === direction) ?? directions[0];
  const parsedDebt = parseWhisper(debtValue);
  const debtName = (parsedDebt?.detail ?? "").trim() || pickedName;
  const debtReady = !!parsedDebt && debtName.length > 0;
  const suggestedNames = uniqueDebtorNames(direction);

  // Pendientes agrupadas por dirección y persona, de mayor a menor.
  const sections = useMemo(
    () =>
      directions
        .map((d) => {
          const byPerson = new Map<string, Debt[]>();
          for (const debt of sharedExpensesWithTransaction) {
            if (debt.paid || debt.direction !== d.value) continue;
            byPerson.set(debt.debtor_name, [...(byPerson.get(debt.debtor_name) ?? []), debt]);
          }
          const people = [...byPerson]
            .map(([name, debts]) => ({ name, debts, total: debts.reduce((s, x) => s + x.amount_owed, 0) }))
            .sort((a, b) => b.total - a.total);
          return { ...d, people, total: people.reduce((s, p) => s + p.total, 0) };
        })
        .filter((s) => s.people.length > 0),
    [sharedExpensesWithTransaction]
  );

  const paidDebts = useMemo(
    () =>
      sharedExpensesWithTransaction
        .filter((d) => d.paid)
        .sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""))
        .slice(0, 15),
    [sharedExpensesWithTransaction]
  );
  const paidCount = sharedExpensesWithTransaction.filter((d) => d.paid).length;

  const recentGastos = useMemo(() => {
    const query = settleQuery.trim().toLowerCase();
    return transactions
      .filter((t) => t.type === "Gasto")
      .filter((t) => !query || `${t.detail ?? ""} ${t.category_name ?? ""}`.toLowerCase().includes(query))
      .slice(0, 30);
  }, [transactions, settleQuery]);

  const resetDebt = () => {
    setDebtValue("");
    setPickedName("");
    setDebtDetail("");
    setDebtExpanded(false);
    setDebtError("");
  };

  const closeAdd = () => {
    setShowAddModal(false);
    resetDebt();
  };

  const closeSettle = () => {
    setSettleTarget(null);
    setSettleQuery("");
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const { kind, debt } = confirm;
    if (kind === "delete") {
      await deleteSharedExpense.mutateAsync(debt.id);
    } else {
      await markAsPaid.mutateAsync({
        sharedExpenseId: debt.id,
        debtorName: debt.debtor_name,
        amount: debt.amount_owed,
        transactionDetail: debt.transaction_detail || undefined,
      });
    }
  };

  const askConfirm = (kind: "paid" | "delete", debt: Debt) => {
    setConfirm({ kind, debt });
    setConfirmOpen(true);
  };

  const handleSettleWithTransaction = async (transactionId: string) => {
    if (!settleTarget) return;
    await settleDebtsIOwe.mutateAsync({
      debts: [{ sharedExpenseId: settleTarget.id }],
      existingTransactionId: transactionId,
    });
    closeSettle();
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
      if (isOwedToMe) {
        await addQuickDebt.mutateAsync({ debtorName: debtName, amount: parsedDebt.amount, detail });
      } else {
        await addManualDebtIOwe.mutateAsync({ creditorName: debtName, amount: parsedDebt.amount, detail });
      }
      closeAdd();
    } catch {
      setDebtError("No se guardó la deuda. Intenta de nuevo.");
    } finally {
      savingDebt.current = false;
    }
  };

  const switchDirection = (next: SharedExpenseDirection) => {
    setDirection(next);
    setPickedName("");
  };

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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Deudas</h1>
          <Button
            className="rounded-full h-10 w-10 p-0 md:w-auto md:px-5 md:h-10"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline text-sm">Nueva deuda</span>
          </Button>
        </div>

        {sections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center">
            <p className="text-base font-medium text-muted-foreground mb-4">Nadie te debe y no le debes a nadie</p>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nueva deuda
            </Button>
          </div>
        ) : (
          sections.map((section) => (
            <section key={section.value} className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">{section.label}</h2>
                <span
                  className={cn("text-lg font-bold tabular-nums", section.amountClass, isPrivacyMode && "privacy-blur")}
                >
                  {fmt(section.total)}
                </span>
              </div>

              {section.people.map((person) => (
                <GlassCard key={person.name}>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <p className="font-semibold text-sm truncate">{person.name}</p>
                    <span className={cn("text-base font-bold tabular-nums", isPrivacyMode && "privacy-blur")}>
                      {fmt(person.total)}
                    </span>
                  </div>

                  <div className="border-t border-border/40">
                    {person.debts.map((debt, i) => (
                      <div
                        key={debt.id}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 hover:bg-accent/30 transition-colors",
                          i < person.debts.length - 1 && "border-b border-border/20"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{debt.transaction_detail || debt.detail || "Sin detalle"}</p>
                          <p className="text-xs text-muted-foreground">
                            {shortDate(debt.transaction_date ?? debt.created_at)}
                          </p>
                        </div>
                        {person.debts.length > 1 && (
                          <span className={cn("text-sm tabular-nums shrink-0", isPrivacyMode && "privacy-blur")}>
                            {fmt(debt.amount_owed)}
                          </span>
                        )}
                        <button
                          className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 hover:bg-success/10 active:bg-success/20 transition-colors"
                          title={debt.direction === "they_owe_me" ? "Marcar como pagada" : "Saldar"}
                          aria-label={debt.direction === "they_owe_me" ? "Marcar como pagada" : "Saldar"}
                          onClick={() =>
                            debt.direction === "they_owe_me"
                              ? askConfirm("paid", debt)
                              : setSettleTarget(debt)
                          }
                        >
                          <CheckCircle2 className="h-[18px] w-[18px] text-success" />
                        </button>
                        <button
                          className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 hover:bg-destructive/10 active:bg-destructive/20 transition-colors"
                          title="Eliminar"
                          aria-label="Eliminar"
                          onClick={() => askConfirm("delete", debt)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                        </button>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              ))}
            </section>
          ))
        )}

        {paidCount > 0 && (
          <div>
            <button
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
              onClick={() => setShowPaid(!showPaid)}
              aria-expanded={showPaid}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", showPaid && "rotate-180")} />
              Pagadas ({paidCount})
            </button>

            {showPaid && (
              <div className="space-y-1">
                {paidDebts.map((debt) => (
                  <div
                    key={debt.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground"
                  >
                    <div className="flex-1 min-w-0 truncate">
                      {debt.debtor_name}
                      <span className="mx-1.5">·</span>
                      <span className="text-xs">{debt.transaction_detail || debt.detail || "Sin detalle"}</span>
                    </div>
                    <span className={cn("tabular-nums text-xs shrink-0", isPrivacyMode && "privacy-blur")}>
                      {debt.direction === "they_owe_me" ? "+" : "−"}
                      {fmt(debt.amount_owed)}
                    </span>
                    {debt.paid_at && <span className="text-xs shrink-0">{shortDate(debt.paid_at)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nueva deuda: una línea con el monto y la persona ("25000 Juan"), la
          dirección en la pastilla de arriba y el detalle en "Más opciones". */}
      <Composer
        open={showAddModal}
        onClose={closeAdd}
        title="Nueva deuda"
        description="Escribe el monto y el nombre de la persona en una línea. Tab cambia entre me deben y yo debo. Abajo puedes tocar un nombre frecuente y, en más opciones, agregar un detalle."
        accent={currentDirection.color}
        focusRef={debtInputRef}
      >
        <form onSubmit={handleAddDebt} className="whisper-form">
          <div className="whisper-type">
            <span className="whisper-dot" aria-hidden="true" />
            <span aria-hidden="true">{currentDirection.label}</span>
            <select
              aria-label="Dirección de la deuda"
              value={direction}
              onChange={(event) => {
                switchDirection(event.target.value as SharedExpenseDirection);
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
              placeholder="25000 Juan"
              className={cn("whisper-input", isPrivacyMode && debtValue && "privacy-blur")}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey) {
                  event.preventDefault();
                  switchDirection(isOwedToMe ? "i_owe_them" : "they_owe_me");
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
      </Composer>

      {/* Saldar deuda: elegir el gasto con el que pagaste. */}
      <Composer
        open={!!settleTarget}
        onClose={closeSettle}
        title="Saldar deuda"
        description="Elige el gasto con el que pagaste esta deuda. Puedes escribir para buscar entre tus últimos gastos."
        accent="#f87171"
        focusRef={settleInputRef}
      >
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
                  le pagaste {fmt(settleTarget.amount_owed)} a {settleTarget.debtor_name}
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
                    {shortDate(tx.date)} · {tx.category_name}
                  </span>
                </span>
                <span className={cn("whisper-debt-row-amount", isPrivacyMode && "privacy-blur")}>{fmt(tx.amount)}</span>
              </button>
            ))}
          </div>
        </div>
      </Composer>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirm}
        title={confirm?.kind === "paid" ? "Confirmar pago" : "Eliminar deuda"}
        description={
          confirm?.kind === "paid"
            ? `Se registrará el pago de ${fmt(confirm.debt.amount_owed)} de ${confirm.debt.debtor_name}.`
            : "Esta acción no se puede deshacer."
        }
        confirmText={confirm?.kind === "paid" ? "Pagado" : "Eliminar"}
        cancelText="Cancelar"
        variant={confirm?.kind === "paid" ? "default" : undefined}
      />
    </Layout>
  );
}
