import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Calendar,
  TrendingDown,
  Wallet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  FileText,
} from "lucide-react";
import { useCreditCards, CreditCardSummary, CreditCard } from "@/hooks/useCreditCards";
import { useInstallments, InstallmentPurchase } from "@/hooks/useInstallments";
import { useTransactions } from "@/hooks/useTransactions";
import { CreditCardModal } from "@/components/CreditCardModal";
import { InstallmentModal } from "@/components/InstallmentModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import { format, addMonths, subMonths, setDate, isAfter, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";

// Helper: Get billing cycle dates for a card
function getBillingCycle(billingDay: number, cycleOffset: number = 0) {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Determine if we're before or after the billing day this month
  const billingDateThisMonth = new Date(currentYear, currentMonth, billingDay);
  
  let cycleEndDate: Date;
  if (today <= billingDateThisMonth) {
    // We're before billing day, so current cycle ends this month
    cycleEndDate = billingDateThisMonth;
  } else {
    // We're after billing day, so current cycle ends next month
    cycleEndDate = addMonths(billingDateThisMonth, 1);
  }
  
  // Apply offset (negative = past cycles, positive = future)
  cycleEndDate = addMonths(cycleEndDate, cycleOffset);
  const cycleStartDate = addMonths(cycleEndDate, -1);
  cycleStartDate.setDate(cycleStartDate.getDate() + 1); // Start is day after previous close
  
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
  
  // Billing tab state - now tracks which card and cycle offset (0 = current, -1 = previous, etc)
  const [billingCardId, setBillingCardId] = useState<string | null>(null);
  const [cycleOffset, setCycleOffset] = useState(0); // 0 = current cycle, -1 = previous, etc

  const isLoading = isLoadingCards || isLoadingInstallments;

  // Get selected card for billing (default to first card)
  const selectedBillingCard = useMemo(() => {
    if (billingCardId) {
      return creditCards.find(c => c.id === billingCardId) || creditCards[0];
    }
    return creditCards[0];
  }, [billingCardId, creditCards]);

  // Get billing cycle for selected card
  const billingCycle = useMemo(() => {
    if (!selectedBillingCard) return null;
    return getBillingCycle(selectedBillingCard.billing_day, cycleOffset);
  }, [selectedBillingCard, cycleOffset]);

  // Get card transactions for billing view
  const cardTransactions = useMemo(() => {
    return transactions
      .filter(t => t.card_id !== null)
      .map(t => ({
        ...t,
        cardName: creditCards.find(c => c.id === t.card_id)?.name || "Sin tarjeta",
        cardColor: creditCards.find(c => c.id === t.card_id)?.color || "#6366f1",
        billingDay: creditCards.find(c => c.id === t.card_id)?.billing_day || 1,
      }));
  }, [transactions, creditCards]);

  // Filter transactions by billing cycle
  const billingTransactions = useMemo(() => {
    if (!selectedBillingCard || !billingCycle) return [];
    
    return cardTransactions
      .filter(t => {
        if (t.card_id !== selectedBillingCard.id) return false;
        const txDate = startOfDay(new Date(t.date));
        return txDate >= billingCycle.start && txDate <= billingCycle.end;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [cardTransactions, selectedBillingCard, billingCycle]);

  // Calculate billing totals
  const billingTotals = useMemo(() => {
    return billingTransactions.reduce(
      (acc, t) => {
        if (t.type === "Gasto") {
          acc.gastos += Number(t.amount);
        } else if (t.type === "Ingreso") {
          acc.abonos += Number(t.amount);
        }
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

  // Group installments by card
  const installmentsByCard = installments.reduce((acc, inst) => {
    if (!acc[inst.card_id]) {
      acc[inst.card_id] = [];
    }
    acc[inst.card_id].push(inst);
    return acc;
  }, {} as Record<string, InstallmentPurchase[]>);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Tarjetas de Crédito</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona tus tarjetas y compras en cuotas
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditingCard(null);
                setCardModalOpen(true);
              }}
            >
              <CreditCardIcon className="h-4 w-4 mr-2" />
              Nueva Tarjeta
            </Button>
            <Button
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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cupo Total</p>
                  <p className={cn("text-xl font-bold", isPrivacyMode && "privacy-blur")}>
                    {formatCurrency(cardTotals.totalLimit)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cupo Usado</p>
                  <p className={cn("text-xl font-bold text-destructive", isPrivacyMode && "privacy-blur")}>
                    {formatCurrency(cardTotals.totalUsed)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Disponible</p>
                  <p className={cn("text-xl font-bold text-success", isPrivacyMode && "privacy-blur")}>
                    {formatCurrency(cardTotals.totalAvailable)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Calendar className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pago Mensual</p>
                  <p className={cn("text-xl font-bold text-orange-500", isPrivacyMode && "privacy-blur")}>
                    {formatCurrency(installmentTotals.monthlyPayment)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="cards" className="space-y-4">
          <TabsList>
            <TabsTrigger value="cards" className="gap-2">
              <CreditCardIcon className="h-4 w-4" />
              Tarjetas
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <FileText className="h-4 w-4" />
              Facturación
            </TabsTrigger>
            <TabsTrigger value="installments" className="gap-2">
              <Receipt className="h-4 w-4" />
              Cuotas
            </TabsTrigger>
          </TabsList>

          {/* TARJETAS TAB */}
          <TabsContent value="cards" className="space-y-4">
            {creditCards.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cardSummaries.map((card) => (
                  <CreditCardItem
                    key={card.id}
                    card={card}
                    installments={installmentsByCard[card.id] || []}
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
            )}
          </TabsContent>

          {/* FACTURACIÓN TAB - Por ciclo de facturación real */}
          <TabsContent value="billing" className="space-y-4">
            {creditCards.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CreditCardIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Agrega una tarjeta para ver la facturación</p>
              </div>
            ) : (
              <>
                {/* Card selector + Cycle navigation */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Card selector */}
                  <Select 
                    value={selectedBillingCard?.id || ""} 
                    onValueChange={(v) => {
                      setBillingCardId(v);
                      setCycleOffset(0); // Reset to current cycle
                    }}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Selecciona tarjeta" />
                    </SelectTrigger>
                    <SelectContent>
                      {creditCards.map(card => (
                        <SelectItem key={card.id} value={card.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: card.color || "#6366f1" }}
                            />
                            {card.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Cycle navigation */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCycleOffset(cycleOffset - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="min-w-[160px] text-center">
                      <span className="font-semibold capitalize">
                        {billingCycle?.label || "—"}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCycleOffset(cycleOffset + 1)}
                      disabled={cycleOffset >= 0}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Cycle info */}
                {billingCycle && selectedBillingCard && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground border-b pb-3">
                    <span>
                      Cierre día {selectedBillingCard.billing_day} • Pago día {selectedBillingCard.payment_day}
                    </span>
                    <span>
                      Período: {format(billingCycle.start, "dd MMM", { locale: es })} → {format(billingCycle.end, "dd MMM yyyy", { locale: es })}
                    </span>
                    <Badge variant={billingCycle.isClosed ? "secondary" : "default"} className="ml-auto">
                      {billingCycle.isClosed ? "Facturado" : "Por facturar"}
                    </Badge>
                  </div>
                )}

                {/* Totals */}
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Cargos: </span>
                    <span className={cn("font-semibold text-destructive", isPrivacyMode && "privacy-blur")}>
                      {formatCurrency(billingTotals.gastos)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Abonos: </span>
                    <span className={cn("font-semibold text-success", isPrivacyMode && "privacy-blur")}>
                      {formatCurrency(billingTotals.abonos)}
                    </span>
                  </div>
                  <div className="sm:ml-auto">
                    <span className="text-muted-foreground">Total: </span>
                    <span className={cn("font-bold text-lg", isPrivacyMode && "privacy-blur")}>
                      {formatCurrency(billingTotals.gastos - billingTotals.abonos)}
                    </span>
                  </div>
                </div>

                {/* Transactions table */}
                {billingTransactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Sin movimientos en este período</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr className="border-b">
                          <th className="text-left px-3 py-2 font-medium w-20">Fecha</th>
                          <th className="text-left px-3 py-2 font-medium">Descripción</th>
                          <th className="text-right px-3 py-2 font-medium w-28">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {billingTransactions.map(tx => (
                          <tr key={tx.id} className="hover:bg-muted/30">
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                              {format(new Date(tx.date), "dd/MM")}
                            </td>
                            <td className={cn("px-3 py-2", isPrivacyMode && "privacy-blur")}>
                              {tx.detail || tx.category_name}
                            </td>
                            <td className={cn(
                              "px-3 py-2 text-right font-medium whitespace-nowrap",
                              tx.type === "Ingreso" ? "text-success" : "",
                              isPrivacyMode && "privacy-blur"
                            )}>
                              {tx.type === "Ingreso" && "+"}{formatCurrency(tx.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/30 font-semibold border-t">
                        <tr>
                          <td colSpan={2} className="px-3 py-2 text-right">
                            Total:
                          </td>
                          <td className={cn("px-3 py-2 text-right", isPrivacyMode && "privacy-blur")}>
                            {formatCurrency(billingTotals.gastos - billingTotals.abonos)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* CUOTAS TAB */}
          <TabsContent value="installments" className="space-y-4">
            {installments.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-semibold mb-2">Sin compras en cuotas</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Registra una compra y las cuotas se agregarán automáticamente a Movimientos
                  </p>
                  <Button onClick={() => setInstallmentModalOpen(true)} disabled={creditCards.length === 0}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Compra
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {installments.map((inst) => (
                  <InstallmentItemSimple
                    key={inst.id}
                    installment={inst}
                    isExpanded={expandedInstallment === inst.id}
                    isPrivacyMode={isPrivacyMode}
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
          </TabsContent>
        </Tabs>
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
        description="Se eliminará el registro de esta compra en cuotas. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        onConfirm={handleDeleteInstallment}
        variant="destructive"
      />
    </Layout>
  );
}

// Credit Card Item Component
function CreditCardItem({
  card,
  installments,
  isPrivacyMode,
  formatCurrency,
  onEdit,
  onDelete,
  onAddInstallment,
}: {
  card: CreditCardSummary;
  installments: InstallmentPurchase[];
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
      {/* Card Visual */}
      <div
        className="relative h-32 p-4 text-white"
        style={{ background: `linear-gradient(135deg, ${card.color} 0%, ${card.color}cc 100%)` }}
      >
        <div className="relative z-10 h-full flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <CreditCardIcon className="h-6 w-6 opacity-80" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white hover:bg-white/20">
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
          
          <div>
            <p className="font-semibold">{card.name}</p>
            <p className={cn("text-xs opacity-80", isPrivacyMode && "privacy-blur")}>
              Cierre: día {card.billing_day} • Pago: día {card.payment_day}
            </p>
          </div>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Usage */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Cupo usado</span>
            <span className={cn("font-semibold", isHighUsage && "text-destructive", isPrivacyMode && "privacy-blur")}>
              {formatCurrency(card.total_used_credit)} / {formatCurrency(card.credit_limit)}
            </span>
          </div>
          <Progress 
            value={usedPercent} 
            className={cn("h-2", isHighUsage && "[&>div]:bg-destructive")}
          />
          {isHighUsage && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Cupo casi agotado
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-2 bg-success/10 rounded-lg">
            <p className="text-xs text-muted-foreground">Disponible</p>
            <p className={cn("font-bold text-success", isPrivacyMode && "privacy-blur")}>
              {formatCurrency(card.available_credit)}
            </p>
          </div>
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <p className="text-xs text-muted-foreground">Próximo pago</p>
            <p className={cn("font-bold text-orange-500", isPrivacyMode && "privacy-blur")}>
              {formatCurrency(card.next_payment_installments)}
            </p>
          </div>
        </div>

        {/* Active installments count */}
        {card.active_installment_count > 0 && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Receipt className="h-3 w-3" />
            {card.active_installment_count} compra{card.active_installment_count > 1 ? "s" : ""} en cuotas
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Simplified Installment Item - transactions are auto-created
function InstallmentItemSimple({
  installment,
  isExpanded,
  isPrivacyMode,
  formatCurrency,
  getInstallmentSchedule,
  onToggleExpand,
  onEdit,
  onDelete,
}: {
  installment: InstallmentPurchase;
  isExpanded: boolean;
  isPrivacyMode: boolean;
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
  const paidCount = schedule.filter(s => s.date <= today).length;
  const progress = (paidCount / installment.total_installments) * 100;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Card color indicator */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: installment.card_color || "#6366f1" }}
          >
            <Receipt className="h-5 w-5 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="font-semibold truncate">{installment.description}</h4>
                <p className="text-xs text-muted-foreground">
                  {installment.card_name} • {installment.category_name}
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
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

            {/* Summary */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className={cn("font-bold text-sm", isPrivacyMode && "privacy-blur")}>
                  {formatCurrency(installment.total_amount)}
                </p>
              </div>
              <div className="p-2 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Cuotas</p>
                <p className="font-bold text-sm">{installment.total_installments}x</p>
              </div>
              <div className="p-2 bg-destructive/10 rounded-lg">
                <p className="text-xs text-muted-foreground">Mensual</p>
                <p className={cn("font-bold text-sm text-destructive", isPrivacyMode && "privacy-blur")}>
                  {formatCurrency(installment.installment_amount)}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Facturadas</span>
                <span>{paidCount}/{installment.total_installments}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Expand button */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 h-7 text-xs"
              onClick={onToggleExpand}
            >
              Ver calendario de facturación
              <ChevronRight className={cn("h-3 w-3 ml-1 transition-transform", isExpanded && "rotate-90")} />
            </Button>

            {/* Expanded: Schedule */}
            {isExpanded && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  Las cuotas se agregaron automáticamente a Movimientos
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {schedule.map((s) => {
                    const isBilled = s.date <= today;
                    return (
                      <div
                        key={s.number}
                        className={cn(
                          "text-center p-2 rounded-lg text-xs",
                          isBilled && "bg-success/10 text-success",
                          !isBilled && "bg-muted/50 text-muted-foreground"
                        )}
                      >
                        <p className="font-bold">{s.number}</p>
                        <p className="text-[10px] opacity-70">{s.dateFormatted}</p>
                        {isBilled && <CheckCircle2 className="h-3 w-3 mx-auto mt-1" />}
                        {!isBilled && <Clock className="h-3 w-3 mx-auto mt-1 opacity-50" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
