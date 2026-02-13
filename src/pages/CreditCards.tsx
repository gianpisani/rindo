import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
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
import { format, addMonths, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";

// Helper: Get billing cycle dates for a card
function getBillingCycle(billingDay: number, cycleOffset: number = 0) {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const billingDateThisMonth = new Date(currentYear, currentMonth, billingDay);

  let cycleEndDate: Date;
  if (today <= billingDateThisMonth) {
    cycleEndDate = billingDateThisMonth;
  } else {
    cycleEndDate = addMonths(billingDateThisMonth, 1);
  }

  cycleEndDate = addMonths(cycleEndDate, cycleOffset);
  const cycleStartDate = addMonths(cycleEndDate, -1);
  cycleStartDate.setDate(cycleStartDate.getDate() + 1);

  const isClosed = cycleEndDate < today;

  return {
    start: startOfDay(cycleStartDate),
    end: startOfDay(cycleEndDate),
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
        const txDate = startOfDay(new Date(t.date));
        return txDate >= billingCycle.start && txDate <= billingCycle.end;
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
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Tarjetas de Crédito</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona tus tarjetas y compras en cuotas
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingCard(null);
                setCardModalOpen(true);
              }}
            >
              <CreditCardIcon className="h-4 w-4 mr-2" />
              Nueva Tarjeta
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingInstallment(null);
                setInstallmentModalOpen(true);
              }}
              disabled={creditCards.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Compra
            </Button>
          </div>
        </div>

        {creditCards.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <CreditCardIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold mb-2">No tienes tarjetas</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Agrega tu primera tarjeta de crédito para comenzar
              </p>
              <Button onClick={() => setCardModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Tarjeta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── Overview Banner ── */}
            <Card className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">Cupo utilizado</span>
                  <span className={cn(
                    "text-sm font-medium font-mono tabular-nums",
                    totalUsedPercent > 80 && "text-destructive",
                    isPrivacyMode && "privacy-blur"
                  )}>
                    {Math.round(totalUsedPercent)}%
                  </span>
                </div>
                <Progress
                  value={totalUsedPercent}
                  className={cn("h-2.5 mb-3", totalUsedPercent > 80 && "[&>div]:bg-destructive")}
                />
                <div className={cn("text-xs text-muted-foreground mb-4 font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                  {formatCurrency(cardTotals.totalUsed)} de {formatCurrency(cardTotals.totalLimit)}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/10">
                      <Wallet className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Disponible</p>
                      <p className={cn("text-lg font-bold font-mono tabular-nums text-success", isPrivacyMode && "privacy-blur")}>
                        {formatCurrency(cardTotals.totalAvailable)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/10">
                      <Calendar className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pago mensual</p>
                      <p className={cn("text-lg font-bold font-mono tabular-nums text-orange-500", isPrivacyMode && "privacy-blur")}>
                        {formatCurrency(installmentTotals.monthlyPayment)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Cards Grid ── */}
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Mis Tarjetas
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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
            </div>

            {/* ── Active Installments ── */}
            {installments.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Cuotas activas
                  </h2>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {activeInstallments.length} activa{activeInstallments.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="space-y-2">
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
              </div>
            )}

            {/* ── Billing / Estado de cuenta ── */}
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Estado de cuenta
              </h2>
              <Card>
                <CardContent className="p-4 space-y-4">
                  {/* Card selector + Cycle navigation */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <Select
                      value={selectedBillingCard?.id || ""}
                      onValueChange={(v) => {
                        setBillingCardId(v);
                        setCycleOffset(0);
                      }}
                    >
                      <SelectTrigger className="w-[200px] h-9">
                        <SelectValue placeholder="Selecciona tarjeta" />
                      </SelectTrigger>
                      <SelectContent>
                        {creditCards.map(card => (
                          <SelectItem key={card.id} value={card.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: card.color || "#6366f1" }}
                              />
                              {card.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCycleOffset(cycleOffset - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="min-w-[140px] text-center text-sm font-medium capitalize">
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

                  {/* Cycle metadata */}
                  {billingCycle && selectedBillingCard && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>Cierre día {selectedBillingCard.billing_day}</span>
                      <span className="text-border">·</span>
                      <span>Pago día {selectedBillingCard.payment_day}</span>
                      <span className="text-border">·</span>
                      <span>
                        {format(billingCycle.start, "dd MMM", { locale: es })} → {format(billingCycle.end, "dd MMM yyyy", { locale: es })}
                      </span>
                      <Badge variant={billingCycle.isClosed ? "secondary" : "default"} className="ml-auto text-[10px]">
                        {billingCycle.isClosed ? "Facturado" : "Por facturar"}
                      </Badge>
                    </div>
                  )}

                  {/* Transactions table */}
                  {billingTransactions.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <FileText className="h-7 w-7 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Sin movimientos en este período</p>
                    </div>
                  ) : (
                    <>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr className="border-b">
                              <th className="text-left px-3 py-2 font-medium text-xs w-20">Fecha</th>
                              <th className="text-left px-3 py-2 font-medium text-xs">Descripción</th>
                              <th className="text-right px-3 py-2 font-medium text-xs w-28">Monto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {billingTransactions.map(tx => (
                              <tr key={tx.id} className="hover:bg-muted/30">
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap text-xs">
                                  {format(new Date(tx.date), "dd/MM")}
                                </td>
                                <td className={cn("px-3 py-2 text-xs", isPrivacyMode && "privacy-blur")}>
                                  {tx.detail || tx.category_name}
                                </td>
                                <td className={cn(
                                  "px-3 py-2 text-right font-medium font-mono tabular-nums whitespace-nowrap text-xs",
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

                      {/* Billing totals */}
                      <div className="flex items-center justify-end gap-4 text-sm pt-1">
                        <div className="text-muted-foreground">
                          Cargos{" "}
                          <span className={cn("font-mono tabular-nums font-medium text-foreground", isPrivacyMode && "privacy-blur")}>
                            {formatCurrency(billingTotals.gastos)}
                          </span>
                        </div>
                        {billingTotals.abonos > 0 && (
                          <div className="text-muted-foreground">
                            Abonos{" "}
                            <span className={cn("font-mono tabular-nums font-medium text-success", isPrivacyMode && "privacy-blur")}>
                              {formatCurrency(billingTotals.abonos)}
                            </span>
                          </div>
                        )}
                        <div className="font-semibold">
                          Total{" "}
                          <span className={cn("font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                            {formatCurrency(billingTotals.gastos - billingTotals.abonos)}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

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

  return (
    <Card className="overflow-hidden">
      <div className="flex">
        {/* Color accent bar */}
        <div
          className="w-1.5 flex-shrink-0"
          style={{ backgroundColor: card.color || "#6366f1" }}
        />

        <CardContent className="flex-1 p-4 space-y-3">
          {/* Header: name + menu */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-sm">{card.name}</h3>
              <p className="text-[11px] text-muted-foreground">
                Cierre: {card.billing_day} · Pago: {card.payment_day}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
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

          {/* Usage bar */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className={cn(
                "text-xs font-mono tabular-nums",
                isHighUsage ? "text-destructive font-medium" : "text-muted-foreground",
                isPrivacyMode && "privacy-blur"
              )}>
                {formatCurrency(card.total_used_credit)} / {formatCurrency(card.credit_limit)}
              </span>
              <span className={cn(
                "text-xs font-mono tabular-nums",
                isHighUsage && "text-destructive font-medium"
              )}>
                {Math.round(usedPercent)}%
              </span>
            </div>
            <Progress
              value={usedPercent}
              className={cn("h-1.5", isHighUsage && "[&>div]:bg-destructive")}
            />
            {isHighUsage && (
              <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Cupo casi agotado
              </p>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-muted-foreground">Disponible </span>
              <span className={cn("font-semibold font-mono tabular-nums text-success", isPrivacyMode && "privacy-blur")}>
                {formatCurrency(card.available_credit)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Pago </span>
              <span className={cn("font-semibold font-mono tabular-nums text-orange-500", isPrivacyMode && "privacy-blur")}>
                {formatCurrency(card.next_payment_installments)}
              </span>
            </div>
          </div>

          {/* Installments badge */}
          {card.active_installment_count > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-0.5">
              <Receipt className="h-3 w-3" />
              {card.active_installment_count} compra{card.active_installment_count > 1 ? "s" : ""} en cuotas
            </div>
          )}
        </CardContent>
      </div>
    </Card>
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
    <Card className={cn(!isActive && "opacity-60")}>
      <CardContent className="p-3">
        {/* Main row */}
        <div className="flex items-center gap-3">
          {/* Color dot */}
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: installment.card_color || "#6366f1" }}
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
          <div className="mt-3 pt-3 border-t">
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
      </CardContent>
    </Card>
  );
}
