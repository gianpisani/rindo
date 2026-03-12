import { useState } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { useMonthlySummary } from "@/hooks/useMonthlySummary";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { TrendingUp, TrendingDown, PiggyBank, Receipt, Eye, Variable, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { MonthlyStory } from "@/components/MonthlyStory";

const Index = () => {
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const { limits } = useCategoryLimits();
  const navigate = useNavigate();
  const { openQuickAdd, openReconciliation } = useGlobalDrawers();
  const { isPrivacyMode } = usePrivacyMode();
  const [storyOpen, setStoryOpen] = useState(false);

  const handleQuickAdd = (type: "Ingreso" | "Gasto" | "Inversión") => {
    openQuickAdd(type);
  };

  // Calcular stats del mes actual
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const currentMonthTransactions = transactions.filter((t) => {
    const date = new Date(t.date);
    return date >= monthStart && date <= monthEnd;
  });

  const lastMonthTransactions = transactions.filter((t) => {
    const date = new Date(t.date);
    return date >= lastMonthStart && date <= lastMonthEnd;
  });

  const currentIncome = currentMonthTransactions
    .filter((t) => t.type === "Ingreso")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const currentExpenses = currentMonthTransactions
    .filter((t) => t.type === "Gasto")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const currentInvestments = currentMonthTransactions
    .filter((t) => t.type === "Inversión")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const lastMonthExpenses = lastMonthTransactions
    .filter((t) => t.type === "Gasto")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const lastMonthIncome = lastMonthTransactions
    .filter((t) => t.type === "Ingreso")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Balance total real (todas las transacciones)
  const totalBalance = transactions.reduce((acc, t) => {
    if (t.type === "Ingreso") return acc + Number(t.amount);
    if (t.type === "Gasto" || t.type === "Inversión") return acc - Number(t.amount);
    return acc;
  }, 0);

  const expenseChange = lastMonthExpenses > 0
    ? ((currentExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
    : 0;
  const incomeChange = lastMonthIncome > 0
    ? ((currentIncome - lastMonthIncome) / lastMonthIncome) * 100
    : 0;

  // Last month data for Monthly Story
  const lastMonth = subMonths(now, 1);
  const lastMonthSummary = useMonthlySummary(transactions, categories, limits, lastMonth);
  const hasLastMonthData = lastMonthSummary.transactionCount > 0;

  // Últimas 20 transacciones
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const typeIcons = {
    Ingreso: TrendingUp,
    Gasto: TrendingDown,
    Inversión: PiggyBank,
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Hero Balance Card */}
        <Card className="p-6 md:p-8 border-border/50">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Balance Total</span>
              <span className="text-xs text-muted-foreground font-mono tabular-nums">
                {format(now, "MMMM yyyy", { locale: es })}
              </span>
            </div>
            <div className={cn("text-4xl md:text-5xl font-bold font-mono tabular-nums tracking-tight", isPrivacyMode && "privacy-blur")}>
              $<NumberFlow
                value={totalBalance}
                format={{
                  style: "decimal",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }}
                locales="es-CL"
              />
            </div>
            <div className="space-y-2 pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground font-medium">Este mes ({format(now, "MMM yyyy", { locale: es })})</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-success">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Ingresos</span>
                  </div>
                  <p className={cn("text-sm font-semibold font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                    $<NumberFlow
                      value={currentIncome}
                      format={{
                        style: "decimal",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      }}
                      locales="es-CL"
                    />
                  </p>
                  {incomeChange !== 0 && (
                    <p className={cn(
                      "text-xs",
                      incomeChange > 0 ? "text-success" : "text-destructive",
                      isPrivacyMode && "privacy-blur"
                    )}>
                      {incomeChange > 0 ? "+" : ""}
                      <NumberFlow
                        value={incomeChange}
                        format={{
                          style: "decimal",
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        }}
                      />%
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-destructive">
                    <TrendingDown className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Gastos</span>
                  </div>
                  <p className={cn("text-sm font-semibold font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                    $<NumberFlow
                      value={currentExpenses}
                      format={{
                        style: "decimal",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      }}
                      locales="es-CL"
                    />
                  </p>
                  {expenseChange !== 0 && (
                    <p className={cn(
                      "text-xs",
                      expenseChange > 0 ? "text-destructive" : "text-success",
                      isPrivacyMode && "privacy-blur"
                    )}>
                      {expenseChange > 0 ? "+" : ""}
                      <NumberFlow
                        value={expenseChange}
                        format={{
                          style: "decimal",
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        }}
                      />%
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-blue">
                    <PiggyBank className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Inversiones</span>
                  </div>
                  <p className={cn("text-sm font-semibold font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                    $<NumberFlow
                      value={currentInvestments}
                      format={{
                        style: "decimal",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      }}
                      locales="es-CL"
                    />
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button
            onClick={() => handleQuickAdd("Ingreso")}
            className="h-20 md:h-24 flex-col gap-2 border-2 border-success/30 text-success hover:bg-success/10 bg-transparent"
          >
            <TrendingUp className="h-6 w-6" />
            <span className="text-sm font-semibold">Ingreso</span>
          </Button>
          <Button
            onClick={() => handleQuickAdd("Gasto")}
            className="h-20 md:h-24 flex-col gap-2 border-2 border-destructive/30 text-destructive hover:bg-destructive/10 bg-transparent"
          >
            <TrendingDown className="h-6 w-6" />
            <span className="text-sm font-semibold">Gasto</span>
          </Button>
          <Button
            onClick={() => handleQuickAdd("Inversión")}
            className="h-20 md:h-24 flex-col gap-2 border-2 border-blue/30 text-blue hover:bg-blue/10 bg-transparent"
          >
            <PiggyBank className="h-6 w-6" />
            <span className="text-sm font-semibold">Inversión</span>
          </Button>
          <Button
            onClick={() => openReconciliation()}
            variant="outline"
            className="h-20 md:h-24 flex-col gap-2 hover:bg-muted"
          >
            <Variable className="h-6 w-6" />
            <span className="text-sm font-semibold">Conciliar</span>
          </Button>
        </div>

        {/* Recent Transactions */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recientes</h2>
            <Button
              onClick={() => navigate("/transactions")}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              Ver todo
              <Eye className="h-4 w-4" />
            </Button>
          </div>
          {recentTransactions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No hay transacciones aún</p>
              <p className="text-xs mt-1">Agrega tu primera transacción arriba</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[420px] -mx-2 px-2">
              {recentTransactions.map((transaction, index) => {
                const Icon = typeIcons[transaction.type];
                const isLast = index === recentTransactions.length - 1;
                return (
                  <div
                    key={transaction.id}
                    className={cn(
                      "flex items-center justify-between py-2.5 px-2 hover:bg-muted/40 rounded-md transition-colors cursor-default",
                      !isLast && "border-b border-border/30"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full flex-shrink-0",
                        transaction.type === "Ingreso" && "bg-success",
                        transaction.type === "Gasto" && "bg-destructive",
                        transaction.type === "Inversión" && "bg-blue"
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm font-medium truncate leading-tight", isPrivacyMode && "privacy-blur")}>
                          {transaction.category_name}
                          {transaction.detail && (
                            <span className="text-muted-foreground font-normal"> · {transaction.detail}</span>
                          )}
                        </p>
                        <p className={cn("text-xs text-muted-foreground leading-tight", isPrivacyMode && "privacy-blur-light")}>
                          {format(new Date(transaction.date), "d MMM", { locale: es })}
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      "text-sm font-semibold whitespace-nowrap ml-3 flex-shrink-0 font-mono tabular-nums",
                      transaction.type === "Ingreso" && "text-success",
                      transaction.type === "Gasto" && "text-destructive",
                      transaction.type === "Inversión" && "text-blue",
                      isPrivacyMode && "privacy-blur"
                    )}>
                      {formatCurrency(Number(transaction.amount))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Monthly Story - Last month review */}
        {hasLastMonthData && (
          <button
            onClick={() => setStoryOpen(true)}
            className="w-full group relative overflow-hidden rounded-xl border border-border/50 p-5 text-left transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tu resumen de</p>
                <p className="text-lg font-bold capitalize">
                  {format(lastMonth, "MMMM yyyy", { locale: es })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lastMonthSummary.transactionCount} transacciones &middot; Toca para ver
                </p>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                <Play className="h-4 w-4 ml-0.5" />
              </div>
            </div>
          </button>
        )}
      </div>

      <MonthlyStory
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        month={lastMonth}
        kpis={lastMonthSummary.kpis}
        categoryBreakdown={lastMonthSummary.categoryBreakdown}
        dailyStats={lastMonthSummary.dailyStats}
        transactionCount={lastMonthSummary.transactionCount}
      />
    </Layout>
  );
};

export default Index;
