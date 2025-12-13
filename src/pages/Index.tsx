import { useState } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuickAddDrawer } from "@/components/QuickAddDrawer";
import { ReconciliationDrawer } from "@/components/ReconciliationDrawer";
import { useTransactions } from "@/hooks/useTransactions";
import { TrendingUp, TrendingDown, PiggyBank, Receipt, Calculator, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";

const Index = () => {
  const { transactions } = useTransactions();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reconciliationOpen, setReconciliationOpen] = useState(false);
  const [preselectedType, setPreselectedType] = useState<"Ingreso" | "Gasto" | "Inversión" | undefined>();
  const { isPrivacyMode } = usePrivacyMode();

  const handleQuickAdd = (type: "Ingreso" | "Gasto" | "Inversión") => {
    setPreselectedType(type);
    setDrawerOpen(true);
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

  // Últimas 5 transacciones
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

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
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground font-medium">Balance Total</span>
              <span className="text-xs text-muted-foreground">
                {format(now, "MMMM yyyy", { locale: es })}
              </span>
            </div>
            <div className={cn("text-4xl md:text-5xl font-bold", isPrivacyMode && "privacy-blur")}>
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
                  <p className={cn("text-sm font-semibold", isPrivacyMode && "privacy-blur")}>
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
                  <p className={cn("text-sm font-semibold", isPrivacyMode && "privacy-blur")}>
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
                  <p className={cn("text-sm font-semibold", isPrivacyMode && "privacy-blur")}>
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
            className="h-20 md:h-24 flex-col gap-2 bg-success hover:bg-success/90 text-white shadow-lg"
          >
            <TrendingUp className="h-6 w-6" />
            <span className="text-sm font-semibold">Ingreso</span>
          </Button>
          <Button
            onClick={() => handleQuickAdd("Gasto")}
            className="h-20 md:h-24 flex-col gap-2 bg-destructive hover:bg-destructive/90 text-white shadow-lg"
          >
            <TrendingDown className="h-6 w-6" />
            <span className="text-sm font-semibold">Gasto</span>
          </Button>
          <Button
            onClick={() => handleQuickAdd("Inversión")}
            className="h-20 md:h-24 flex-col gap-2 bg-blue hover:bg-blue/90 text-white shadow-lg"
          >
            <PiggyBank className="h-6 w-6" />
            <span className="text-sm font-semibold">Inversión</span>
          </Button>
          <Button
            onClick={() => setReconciliationOpen(true)}
            variant="outline"
            className="h-20 md:h-24 flex-col gap-2 border-2 hover:bg-gray-600"
          >
            <Calculator className="h-6 w-6" />
            <span className="text-sm font-semibold">Conciliar</span>
          </Button>
        </div>

        {/* Quick Add Drawer */}
        <QuickAddDrawer 
          open={drawerOpen} 
          onOpenChange={setDrawerOpen}
          defaultType={preselectedType}
        />

        {/* Reconciliation Drawer */}
        <ReconciliationDrawer 
          open={reconciliationOpen} 
          onOpenChange={setReconciliationOpen}
        />

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
          <div className="space-y-3">
            {recentTransactions.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No hay transacciones aún</p>
                <p className="text-xs mt-1">Agrega tu primera transacción arriba</p>
              </div>
            ) : (
              recentTransactions.map((transaction) => {
                const Icon = typeIcons[transaction.type];
                return (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={cn(
                        "p-2 rounded-full",
                        transaction.type === "Ingreso" && "bg-success/10",
                        transaction.type === "Gasto" && "bg-destructive/10",
                        transaction.type === "Inversión" && "bg-blue/10"
                      )}>
                        <Icon className={cn(
                          "h-4 w-4",
                          transaction.type === "Ingreso" && "text-success",
                          transaction.type === "Gasto" && "text-destructive",
                          transaction.type === "Inversión" && "text-blue"
                        )} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm font-medium truncate", isPrivacyMode && "privacy-blur")}>
                          {transaction.category_name}
                        </p>
                        <p className={cn("text-xs text-muted-foreground", isPrivacyMode && "privacy-blur-light")}>
                          {format(new Date(transaction.date), "d MMM", { locale: es })}
                          {transaction.detail && ` • ${transaction.detail}`}
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      "text-sm font-semibold whitespace-nowrap ml-3",
                      transaction.type === "Ingreso" && "text-success",
                      transaction.type === "Gasto" && "text-destructive",
                      transaction.type === "Inversión" && "text-blue",
                      isPrivacyMode && "privacy-blur"
                    )}>
                      {formatCurrency(Number(transaction.amount))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default Index;
