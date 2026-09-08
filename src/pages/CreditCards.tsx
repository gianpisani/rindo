import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Screen, Row, Panel } from "@/components/HairlineGrid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  CreditCard as CreditCardIcon,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  FileText,
  Wallet,
  Calendar,
} from "lucide-react";
import { useCreditCards, CreditCardSummary, CreditCard } from "@/hooks/useCreditCards";
import { useInstallments, InstallmentPurchase } from "@/hooks/useInstallments";
import { useTransactions } from "@/hooks/useTransactions";
import { CreditCardModal } from "@/components/CreditCardModal";
import { InstallmentModal } from "@/components/InstallmentModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import { format, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";

// Banco de Chile billing cutoff: cycles run from 14:00 to 14:00
const BILLING_CUTOFF_HOUR = 14;

// Helper: Get billing cycle dates for a card
function getBillingCycle(billingDay: number, cycleOffset: number = 0) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Billing cutoff is at 14:00 on the billing day
  const billingDateThisMonth = new Date(currentYear, currentMonth, billingDay, BILLING_CUTOFF_HOUR, 0, 0);

  let cycleEndDate: Date;
  if (now < billingDateThisMonth) {
    cycleEndDate = billingDateThisMonth;
  } else {
    cycleEndDate = addMonths(billingDateThisMonth, 1);
  }

  cycleEndDate = addMonths(cycleEndDate, cycleOffset);
  const cycleStartDate = addMonths(cycleEndDate, -1);

  const isClosed = cycleEndDate <= now;

  return {
    start: cycleStartDate,
    end: cycleEndDate,
    isClosed,
    label: format(cycleEndDate, "MMMM yyyy", { locale: es }),
  };
}

export default function CreditCards() {
  const { isPrivacyMode } = usePrivacyMode();
  const {
    creditCards,
    cardSummaries,
    isLoading: isLoadingCards,
    totals: cardTotals,
    addCreditCard,
    updateCreditCard,
    deleteCreditCard,
  } = useCreditCards();

  const {
    installments,
    isLoading: isLoadingInstallments,
    totals: installmentTotals,
    addInstallment,
    updateInstallment,
    deleteInstallment,
    getInstallmentSchedule,
    isInstallmentActive,
  } = useInstallments();

  const { transactions } = useTransactions();

  // Modal states
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [installmentModalOpen, setInstallmentModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [editingInstallment, setEditingInstallment] = useState<InstallmentPurchase | null>(null);
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);
  const [deleteInstallmentId, setDeleteInstallmentId] = useState<string | null>(null);
  const [expandedInstallment, setExpandedInstallment] = useState<string | null>(null);

  // Billing state
  const [billingCardId, setBillingCardId] = useState<string | null>(null);
  const [cycleOffset, setCycleOffset] = useState(0);
  const [billingOpen, setBillingOpen] = useState(true);

  const isLoading = isLoadingCards || isLoadingInstallments;

  const selectedBillingCard = useMemo(() => {
    if (billingCardId) {
      return creditCards.find(c => c.id === billingCardId) || creditCards[0];
    }
    return creditCards[0];
  }, [billingCardId, creditCards]);

  const billingCycle = useMemo(() => {
    if (!selectedBillingCard) return null;
    return getBillingCycle(selectedBillingCard.billing_day, cycleOffset);
  }, [selectedBillingCard, cycleOffset]);

  const billingTransactions = useMemo(() => {
    if (!selectedBillingCard || !billingCycle) return [];

    return transactions
      .filter(t => {
        if (t.card_id !== selectedBillingCard.id) return false;
        const txTime = new Date(t.date).getTime();
        return txTime >= billingCycle.start.getTime() && txTime < billingCycle.end.getTime();
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions, selectedBillingCard, billingCycle]);

  const billingTotals = useMemo(() => {
    return billingTransactions.reduce(
      (acc, t) => {
        if (t.type === "Gasto") acc.gastos += Number(t.amount);
        else if (t.type === "Ingreso") acc.abonos += Number(t.amount);
        return acc;
      },
      { gastos: 0, abonos: 0 }
    );
  }, [billingTransactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleSaveCard = async (card: Omit<CreditCard, "id" | "user_id" | "created_at" | "updated_at">) => {
    if (editingCard) {
      await updateCreditCard.mutateAsync({ id: editingCard.id, ...card });
    } else {
      await addCreditCard.mutateAsync(card);
    }
    setEditingCard(null);
  };

  const handleSaveInstallment = async (
    purchase: Omit<InstallmentPurchase, "id" | "user_id" | "created_at" | "updated_at" | "card_name" | "card_color">
  ) => {
    if (editingInstallment) {
      await updateInstallment.mutateAsync({ id: editingInstallment.id, ...purchase });
    } else {
      await addInstallment.mutateAsync(purchase);
    }
    setEditingInstallment(null);
  };

  const handleDeleteCard = async () => {
    if (deleteCardId) {
      await deleteCreditCard.mutateAsync(deleteCardId);
      setDeleteCardId(null);
    }
  };

  const handleDeleteInstallment = async () => {
    if (deleteInstallmentId) {
      await deleteInstallment.mutateAsync(deleteInstallmentId);
      setDeleteInstallmentId(null);
    }
  };

  const totalUsedPercent = cardTotals.totalLimit > 0
    ? Math.min(100, (cardTotals.totalUsed / cardTotals.totalLimit) * 100)
    : 0;

  const activeInstallments = installments.filter(isInstallmentActive);

  return (
    <Layout bleed>
      {/* Mismo chasis que Inicio: identidad, la franja de cupo, y las
          tarjetas y las cuotas como la fila que cede — las dos scrollean
          por dentro. El estado de cuenta va abajo del pliegue: es una
          consulta, no lo primero que querés ver. */}
      <Screen>
        {/* ── Fila 1 — identidad y los verbos de la página ───────── */}
        <Panel className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-5 lg:shrink-0">
          <div className="min-w-0">
            <h1 className="page-title text-xl md:text-2xl">Tarjetas</h1>
            <p className="eyebrow mt-1">
              {creditCards.length} {creditCards.length === 1 ? "tarjeta" : "tarjetas"}
              {" · "}
              {activeInstallments.length}{" "}
              {activeInstallments.length === 1 ? "compra en cuotas" : "compras en cuotas"}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                setEditingCard(null);
                setCardModalOpen(true);
              }}
            >
              <CreditCardIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva tarjeta</span>
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => {
                setEditingInstallment(null);
                setInstallmentModalOpen(true);
              }}
              disabled={creditCards.length === 0}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva compra</span>
            </Button>
          </div>
        </Panel>

        {creditCards.length === 0 ? (
          <Panel className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center lg:min-h-0 lg:flex-1">
            <div className="flex size-14 items-center justify-center border border-border">
              <CreditCardIcon className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="section-title text-sm">No tienes tarjetas</p>
            <p className="text-xs text-muted-foreground">
              Agrega tu primera tarjeta de crédito para comenzar.
            </p>
            <Button className="mt-2 gap-2" onClick={() => setCardModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Agregar tarjeta
            </Button>
          </Panel>
        ) : (
          <>
            {/* ── Fila 2 — el cupo y lo que sale este mes ─────────── */}
            <Row className="grid-cols-2 lg:shrink-0 lg:grid-cols-[2fr_1fr_1fr]">
              <Panel className="col-span-2 px-4 py-3 md:px-5 lg:col-span-1">
                <div className="flex items-baseline gap-2">
                  <p className="eyebrow">Cupo usado</p>
                  <span
                    className={cn(
                      "font-mono text-xs font-semibold tabular-nums",
                      totalUsedPercent > 80 && "text-destructive",
                      isPrivacyMode && "privacy-blur"
                    )}
                  >
                    {Math.round(totalUsedPercent)}%
                  </span>
                  <span
                    className={cn(
                      "ml-auto font-mono text-[10px] tabular-nums text-muted-foreground",
                      isPrivacyMode && "privacy-blur"
                    )}
                  >
                    {formatCurrency(cardTotals.totalUsed)} / {formatCurrency(cardTotals.totalLimit)}
                  </span>
                </div>
                <Progress
                  value={totalUsedPercent}
                  className={cn("mt-2 h-2", totalUsedPercent > 80 && "[&>div]:bg-destructive")}
                />
              </Panel>

              <Panel className="px-4 py-3 md:px-5">
                <p className="eyebrow">Disponible</p>
                <p
                  className={cn(
                    "mt-1.5 flex items-center gap-1.5 font-mono text-base font-bold tracking-tight tabular-nums text-success md:text-lg",
                    isPrivacyMode && "privacy-blur"
                  )}
                >
                  <Wallet className="h-3.5 w-3.5 shrink-0" />
                  {formatCurrency(cardTotals.totalAvailable)}
                </p>
              </Panel>

              <Panel className="px-4 py-3 md:px-5">
                <p className="eyebrow">Pago del mes</p>
                <p
                  className={cn(
                    "mt-1.5 flex items-center gap-1.5 font-mono text-base font-bold tracking-tight tabular-nums text-warning md:text-lg",
                    isPrivacyMode && "privacy-blur"
                  )}
                >
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  {formatCurrency(installmentTotals.monthlyPayment)}
                </p>
              </Panel>
            </Row>

            {/* ── Fila 3 — las tarjetas y las cuotas. Esta es la que
                cede: las dos listas scrollean por dentro. ─────── */}
            <Row className="lg:min-h-0 lg:flex-1 lg:grid-cols-[1.35fr_1fr]">
              <Panel className="flex flex-col">
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5 md:px-5">
                  <h2 className="section-title text-base">Mis tarjetas</h2>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {cardSummaries.length}
                  </span>
                </div>
                <div className="overflow-y-auto lg:min-h-0 lg:flex-1">
                  {cardSummaries.map((card) => (
                    <CreditCardItem
                      key={card.id}
                      card={card}
                      isPrivacyMode={isPrivacyMode}
                      formatCurrency={formatCurrency}
                      onEdit={() => {
                        const fullCard = creditCards.find((c) => c.id === card.id);
                        if (fullCard) {
                          setEditingCard(fullCard);
                          setCardModalOpen(true);
                        }
                      }}
                      onDelete={() => setDeleteCardId(card.id)}
                      onAddInstallment={() => setInstallmentModalOpen(true)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel className="flex flex-col">
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5 md:px-5">
                  <h2 className="section-title text-base">Cuotas</h2>
                  {installments.length > 0 && (
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {activeInstallments.length} activa{activeInstallments.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {installments.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                    <div className="flex size-12 items-center justify-center border border-border">
                      <Receipt className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <p className="section-title text-sm">Sin compras en cuotas</p>
                    <p className="text-xs text-muted-foreground">
                      Registra una y aparece acá con su calendario.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-y-auto lg:min-h-0 lg:flex-1">
                    {installments.map((inst) => (
                      <InstallmentRow
                        key={inst.id}
                        installment={inst}
                        isExpanded={expandedInstallment === inst.id}
                        isPrivacyMode={isPrivacyMode}
                        isActive={isInstallmentActive(inst)}
                        formatCurrency={formatCurrency}
                        getInstallmentSchedule={getInstallmentSchedule}
                        onToggleExpand={() =>
                          setExpandedInstallment(expandedInstallment === inst.id ? null : inst.id)
                        }
                        onEdit={() => {
                          setEditingInstallment(inst);
                          setInstallmentModalOpen(true);
                        }}
                        onDelete={() => setDeleteInstallmentId(inst.id)}
                      />
                    ))}
                  </div>
                )}
              </Panel>
            </Row>
          </>
        )}
      </Screen>

      {/* ── ABAJO DEL PLIEGUE — el estado de cuenta ──────────────── */}
      {creditCards.length > 0 && (
        <div className="grid gap-px border-b border-border bg-border">
          <Panel>
            <Collapsible open={billingOpen} onOpenChange={setBillingOpen}>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-5">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <h2 className="section-title text-xs">Estado de cuenta</h2>
                  <ChevronDown
                    className={cn(
                      "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                      !billingOpen && "-rotate-90"
                    )}
                  />
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                {/* Franja de chrome: qué tarjeta y qué ciclo estás
                    mirando. Controles compactos, todos en una línea. */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border px-4 py-2 md:px-5">
                  <Select
                    value={selectedBillingCard?.id || ""}
                    onValueChange={(v) => {
                      setBillingCardId(v);
                      setCycleOffset(0);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[200px]">
                      <SelectValue placeholder="Selecciona tarjeta" />
                    </SelectTrigger>
                    <SelectContent>
                      {creditCards.map(card => (
                        <SelectItem key={card.id} value={card.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: card.color || "var(--muted-foreground)" }}
                            />
                            {card.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCycleOffset(cycleOffset - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[140px] text-center text-xs font-medium capitalize">
                      {billingCycle?.label || "---"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCycleOffset(cycleOffset + 1)}
                      disabled={cycleOffset >= 0}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Los datos del ciclo: una línea de rótulos, no una caja */}
                {billingCycle && selectedBillingCard && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-1.5 md:px-5">
                    <span className="eyebrow">
                      Cierre {selectedBillingCard.billing_day}
                    </span>
                    <span className="eyebrow">
                      Pago {selectedBillingCard.payment_day}
                    </span>
                    <span className="eyebrow">
                      {format(billingCycle.start, "dd MMM", { locale: es })} → {format(billingCycle.end, "dd MMM yyyy", { locale: es })}
                    </span>
                    <span
                      className={cn(
                        "eyebrow ml-auto border px-1.5 py-0.5",
                        billingCycle.isClosed
                          ? "border-border"
                          : "border-primary text-primary"
                      )}
                    >
                      {billingCycle.isClosed ? "Facturado" : "Por facturar"}
                    </span>
                  </div>
                )}

                {/* Los movimientos del ciclo */}
                {billingTransactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                    <div className="flex size-12 items-center justify-center border border-border">
                      <FileText className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sin movimientos en este período
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-[420px] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-card">
                          <tr className="border-b border-border">
                            <th className="w-20 px-4 py-1.5 text-left md:px-5">
                              <span className="eyebrow">Fecha</span>
                            </th>
                            <th className="px-3 py-1.5 text-left">
                              <span className="eyebrow">Descripción</span>
                            </th>
                            <th className="w-28 px-4 py-1.5 text-right md:px-5">
                              <span className="eyebrow">Monto</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {billingTransactions.map(tx => (
                            <tr
                              key={tx.id}
                              className="border-b border-border transition-colors last:border-b-0 hover:bg-muted"
                            >
                              <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px] tabular-nums text-muted-foreground md:px-5">
                                {format(new Date(tx.date), "dd/MM")}
                              </td>
                              <td className={cn("px-3 py-2 text-xs", isPrivacyMode && "privacy-blur")}>
                                {tx.detail || tx.category_name}
                              </td>
                              <td className={cn(
                                "whitespace-nowrap px-4 py-2 text-right font-mono text-xs font-medium tabular-nums md:px-5",
                                tx.type === "Ingreso" ? "text-success" : "",
                                isPrivacyMode && "privacy-blur"
                              )}>
                                {tx.type === "Ingreso" && "+"}{formatCurrency(tx.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* El cierre del ciclo, en su propia franja */}
                    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-xs md:px-5">
                      <span className="text-muted-foreground">
                        Cargos{" "}
                        <span className={cn("font-mono font-medium tabular-nums text-foreground", isPrivacyMode && "privacy-blur")}>
                          {formatCurrency(billingTotals.gastos)}
                        </span>
                      </span>
                      {billingTotals.abonos > 0 && (
                        <span className="text-muted-foreground">
                          Abonos{" "}
                          <span className={cn("font-mono font-medium tabular-nums text-success", isPrivacyMode && "privacy-blur")}>
                            {formatCurrency(billingTotals.abonos)}
                          </span>
                        </span>
                      )}
                      <span className="section-title text-xs">
                        Total{" "}
                        <span className={cn("font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                          {formatCurrency(billingTotals.gastos - billingTotals.abonos)}
                        </span>
                      </span>
                    </div>
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>
          </Panel>
        </div>
      )}

      {/* Modals */}
      <CreditCardModal
        open={cardModalOpen}
        onOpenChange={(open) => {
          setCardModalOpen(open);
          if (!open) setEditingCard(null);
        }}
        card={editingCard}
        onSave={handleSaveCard}
      />

      <InstallmentModal
        open={installmentModalOpen}
        onOpenChange={(open) => {
          setInstallmentModalOpen(open);
          if (!open) setEditingInstallment(null);
        }}
        installment={editingInstallment}
        creditCards={creditCards}
        onSave={handleSaveInstallment}
      />

      <ConfirmDialog
        open={!!deleteCardId}
        onOpenChange={() => setDeleteCardId(null)}
        title="¿Eliminar tarjeta?"
        description="Se eliminarán también todas las compras en cuotas asociadas. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        onConfirm={handleDeleteCard}
        variant="destructive"
      />

      <ConfirmDialog
        open={!!deleteInstallmentId}
        onOpenChange={() => setDeleteInstallmentId(null)}
        title="¿Eliminar compra?"
        description="Se eliminará el registro y todas las cuotas en Movimientos. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        onConfirm={handleDeleteInstallment}
        variant="destructive"
      />
    </Layout>
  );
}

// ─── Credit Card Item ─────────────────────────────────
function CreditCardItem({
  card,
  isPrivacyMode,
  formatCurrency,
  onEdit,
  onDelete,
  onAddInstallment,
}: {
  card: CreditCardSummary;
  isPrivacyMode: boolean;
  formatCurrency: (n: number) => string;
  onEdit: () => void;
  onDelete: () => void;
  onAddInstallment: () => void;
}) {
  const usedPercent = card.credit_limit > 0
    ? Math.min(100, (card.total_used_credit / card.credit_limit) * 100)
    : 0;

  const isHighUsage = usedPercent > 80;

  /* Ya no es una tarjeta flotando en una grilla: es una fila de la lista.
     El color de la tarjeta queda como regla de 3px a la izquierda — el
     mismo recurso que usa Inicio para dar tono sin teñir un bloque. */
  return (
    <div className="flex items-stretch border-b border-border transition-colors last:border-b-0 hover:bg-muted">
      <div
        className="w-[3px] shrink-0"
        style={{ backgroundColor: card.color || "var(--muted-foreground)" }}
        aria-hidden
      />

      <div className="min-w-0 flex-1 px-4 py-3 md:px-5">
        {/* Nombre y el menú */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="truncate text-sm font-semibold">{card.name}</h3>
              {card.last_4_digits && (
                <span className="shrink-0 font-mono text-[11px] tracking-wider text-muted-foreground">
                  ····{card.last_4_digits}
                </span>
              )}
            </div>
            <p className="eyebrow mt-0.5">
              Cierre {card.billing_day} · Pago {card.payment_day}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddInstallment}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva compra
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* El cupo */}
        <div className="mt-2.5">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className={cn(
              "font-mono text-xs tabular-nums",
              isHighUsage ? "font-medium text-destructive" : "text-muted-foreground",
              isPrivacyMode && "privacy-blur"
            )}>
              {formatCurrency(card.total_used_credit)} / {formatCurrency(card.credit_limit)}
            </span>
            <span className={cn(
              "font-mono text-xs tabular-nums",
              isHighUsage && "font-medium text-destructive"
            )}>
              {Math.round(usedPercent)}%
            </span>
          </div>
          <Progress
            value={usedPercent}
            className={cn("h-1.5", isHighUsage && "[&>div]:bg-destructive")}
          />
          {isHighUsage && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
              <AlertTriangle className="h-3 w-3" />
              Cupo casi agotado
            </p>
          )}
        </div>

        {/* Disponible, pago y las cuotas abiertas */}
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
          <span>
            <span className="eyebrow">Disponible </span>
            <span className={cn("font-mono font-semibold tabular-nums text-success", isPrivacyMode && "privacy-blur")}>
              {formatCurrency(card.available_credit)}
            </span>
          </span>
          <span>
            <span className="eyebrow">Pago </span>
            <span className={cn("font-mono font-semibold tabular-nums text-warning", isPrivacyMode && "privacy-blur")}>
              {formatCurrency(card.next_payment_installments)}
            </span>
          </span>
          {card.active_installment_count > 0 && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
              <Receipt className="h-3 w-3" />
              {card.active_installment_count} en cuotas
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Installment Row ─────────────────────────────────
function InstallmentRow({
  installment,
  isExpanded,
  isPrivacyMode,
  isActive,
  formatCurrency,
  getInstallmentSchedule,
  onToggleExpand,
  onEdit,
  onDelete,
}: {
  installment: InstallmentPurchase;
  isExpanded: boolean;
  isPrivacyMode: boolean;
  isActive: boolean;
  formatCurrency: (n: number) => string;
  getInstallmentSchedule: (i: InstallmentPurchase) => Array<{
    number: number;
    date: Date;
    dateFormatted: string;
    amount: number;
    isPaid: boolean;
    isCurrent: boolean;
    isPastDue: boolean;
  }>;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const schedule = getInstallmentSchedule(installment);
  const today = new Date();
  const billedCount = schedule.filter(s => s.date <= today).length;
  const progress = (billedCount / installment.total_installments) * 100;

  return (
    <div
      className={cn(
        "border-b border-border px-4 py-2.5 transition-colors last:border-b-0 md:px-5",
        !isActive && "opacity-60"
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-2.5">
        {/* Color dot */}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: installment.card_color || "var(--muted-foreground)" }}
        />

        {/* Description + card */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-sm truncate">{installment.description}</span>
            <span className="text-[11px] text-muted-foreground flex-shrink-0">
              {installment.card_name}
            </span>
          </div>
        </div>

        {/* Progress text */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {billedCount}/{installment.total_installments}
          </span>
          <span className={cn("text-sm font-semibold font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
            {formatCurrency(installment.installment_amount)}
            <span className="text-[10px] font-normal text-muted-foreground">/mes</span>
          </span>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Progress bar */}
      <div className="mt-2 flex items-center gap-2">
        <Progress value={progress} className="h-1 flex-1" />
        <button
          onClick={onToggleExpand}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 flex-shrink-0"
        >
          Detalle
          <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
        </button>
      </div>

      {/* Expanded schedule */}
      {isExpanded && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>
              {installment.category_name} · Total {" "}
              <span className={cn("font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                {formatCurrency(installment.total_amount)}
              </span>
            </span>
            <span>{installment.total_installments} cuotas</span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-1.5">
            {schedule.map((s) => {
              const isBilled = s.date <= today;
              return (
                <div
                  key={s.number}
                  className={cn(
                    "text-center py-1.5 px-1 rounded text-[10px]",
                    isBilled && "bg-success/10 text-success",
                    !isBilled && "bg-muted/50 text-muted-foreground"
                  )}
                >
                  <span className="font-bold">{s.number}</span>
                  <span className="opacity-60 ml-0.5">{s.dateFormatted}</span>
                  {isBilled ? (
                    <CheckCircle2 className="h-2.5 w-2.5 mx-auto mt-0.5" />
                  ) : (
                    <Clock className="h-2.5 w-2.5 mx-auto mt-0.5 opacity-40" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
