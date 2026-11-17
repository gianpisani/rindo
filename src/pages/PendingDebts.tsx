import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import Layout from "@/components/Layout";
import { GlassCard } from "@/components/GlassCard";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  useSharedExpenses,
  type SharedExpenseDirection,
  type SharedExpenseWithTransaction,
} from "@/hooks/useSharedExpenses";
import { useTransactions } from "@/hooks/useTransactions";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { cn } from "@/lib/utils";
import { CheckCircle2, Trash2, ChevronDown, HandCoins, X } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import "@/components/whisper.css";

const fmt = (n: number) => `$${new Intl.NumberFormat("es-CL").format(n)}`;
const shortDate = (d: string) => new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "short" });

type Debt = SharedExpenseWithTransaction;

/**
 * Deudas es para ver quién me debe, a quién le debo y cuánto. Las deudas
 * nacen en Movimientos, al dividir un gasto, y casi siempre se pagan solas
 * cuando llega la transferencia. Acá solo queda la salida para lo que se pagó
 * en efectivo (marcar como pagada o saldar) y eliminar.
 */
const directions: { value: SharedExpenseDirection; label: string; amountClass: string }[] = [
  { value: "they_owe_me", label: "Me deben", amountClass: "text-amber-500" },
  { value: "i_owe_them", label: "Yo debo", amountClass: "text-destructive" },
];

export default function PendingDebts() {
  const {
    sharedExpensesWithTransaction,
    markAsPaid,
    settleDebtsIOwe,
    deleteSharedExpense,
    isLoading,
  } = useSharedExpenses();
  const { transactions } = useTransactions();
  const { isPrivacyMode } = usePrivacyMode();

  // Marcar como pagada (me deben) o eliminar: un solo diálogo de confirmación.
  // El contenido se queda mientras el diálogo se cierra, para que no cambie en la animación.
  const [confirm, setConfirm] = useState<{ kind: "paid" | "delete"; debt: Debt } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState<Debt | null>(null);
  const [showPaid, setShowPaid] = useState(false);

  const [settleQuery, setSettleQuery] = useState("");
  const settleInputRef = useRef<HTMLInputElement>(null);

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
        <h1 className="text-2xl font-bold tracking-tight">Deudas</h1>

        {sections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center">
            <p className="text-base font-medium text-muted-foreground mb-1">Nadie te debe y no le debes a nadie</p>
            <p className="text-sm text-muted-foreground/70">
              Para crear una deuda, divide un gasto desde{" "}
              <Link to="/transactions" className="underline underline-offset-2 hover:text-foreground">
                Movimientos
              </Link>
              .
            </p>
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
                          {/* La deuda lleva al movimiento que la originó, si lo tiene. */}
                          {debt.transaction_id ? (
                            <Link
                              to={`/transactions?search=${encodeURIComponent(debt.transaction_detail ?? "")}`}
                              className="block text-sm truncate hover:underline underline-offset-2"
                            >
                              {debt.transaction_detail || "Sin detalle"}
                            </Link>
                          ) : (
                            <p className="text-sm truncate">{debt.detail || "Sin detalle"}</p>
                          )}
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

      {/* Saldar deuda: elegir el gasto con el que pagaste. */}
      <Dialog.Root open={!!settleTarget} onOpenChange={(open) => !open && closeSettle()}>
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
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

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
