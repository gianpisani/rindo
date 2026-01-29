import { useCreditCards } from "@/hooks/useCreditCards";
import { useInstallments } from "@/hooks/useInstallments";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { CreditCard, Wallet, TrendingDown, Calendar, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";

export function CreditCardWidget() {
  const { cardSummaries, totals: cardTotals, isLoading: isLoadingCards } = useCreditCards();
  const { installments, totals: installmentTotals, isLoading: isLoadingInstallments } = useInstallments();
  const { isPrivacyMode } = usePrivacyMode();

  const isLoading = isLoadingCards || isLoadingInstallments;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatCompact = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      notation: "compact",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-muted rounded-xl" />
        <div className="h-4 bg-muted rounded w-2/3" />
      </div>
    );
  }

  if (cardSummaries.length === 0) {
    return (
      <div className="text-center py-6">
        <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground mb-3">No tienes tarjetas</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/credit-cards">Agregar tarjeta</Link>
        </Button>
      </div>
    );
  }

  const totalUsedPercent = cardTotals.totalLimit > 0
    ? (cardTotals.totalUsed / cardTotals.totalLimit) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-muted/50 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Disponible</span>
          </div>
          <p className={cn("font-bold text-lg text-success", isPrivacyMode && "privacy-blur")}>
            {formatCompact(cardTotals.totalAvailable)}
          </p>
        </div>
        <div className="p-3 bg-muted/50 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Pago mensual</span>
          </div>
          <p className={cn("font-bold text-lg text-orange-500", isPrivacyMode && "privacy-blur")}>
            {formatCompact(installmentTotals.monthlyPayment)}
          </p>
        </div>
      </div>

      {/* Usage bar */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">Cupo total usado</span>
          <span className={cn("font-medium", isPrivacyMode && "privacy-blur")}>
            {Math.round(totalUsedPercent)}%
          </span>
        </div>
        <Progress 
          value={totalUsedPercent} 
          className={cn("h-2", totalUsedPercent > 80 && "[&>div]:bg-destructive")}
        />
        <div className={cn("flex justify-between text-xs mt-1 text-muted-foreground", isPrivacyMode && "privacy-blur")}>
          <span>{formatCompact(cardTotals.totalUsed)} usado</span>
          <span>de {formatCompact(cardTotals.totalLimit)}</span>
        </div>
      </div>

      {/* Cards mini list */}
      <div className="space-y-2">
        {cardSummaries.slice(0, 3).map((card) => {
          const usedPercent = card.credit_limit > 0
            ? (card.total_used_credit / card.credit_limit) * 100
            : 0;
          
          return (
            <div
              key={card.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: card.color || "#6366f1" }}
              >
                <CreditCard className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{card.name}</p>
                <div className="flex items-center gap-2">
                  <Progress value={usedPercent} className="h-1 flex-1" />
                  <span className={cn("text-xs text-muted-foreground", isPrivacyMode && "privacy-blur")}>
                    {Math.round(usedPercent)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active installments */}
      {installments.length > 0 && (
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">
            {installments.length} compra{installments.length > 1 ? "s" : ""} en cuotas
          </p>
          <div className={cn("text-sm font-semibold", isPrivacyMode && "privacy-blur")}>
            Total: {formatCurrency(installmentTotals.totalAmount)}
          </div>
        </div>
      )}

      {/* Link to full page */}
      <Button asChild variant="ghost" className="w-full justify-between h-9 text-sm">
        <Link to="/credit-cards">
          Ver todas las tarjetas
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
