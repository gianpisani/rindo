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
import { format, startOfMonth, endOfMonth, subMonths, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { MonthlyStory } from "@/components/MonthlyStory";
import { useTodayTraining } from "@/hooks/useTodayTraining";
import { TrainingBanner } from "@/components/training/TrainingBanner";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const Index = () => {
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const { limits } = useCategoryLimits();
  const navigate = useNavigate();
  const { openQuickAdd, openReconciliation } = useGlobalDrawers();
  const { isPrivacyMode } = usePrivacyMode();
  const [storyOpen, setStoryOpen] = useState(false);
  const { sessions: todaySessions, nextRace, isLoading: trainingLoading, markCompleted, markSkipped } = useTodayTraining();
  const { profile: userProfile, avatarUrl } = useUserProfile();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 20) return "Buenas tardes";
    return "Buenas noches";
  };

  const displayName = userProfile?.nickname || userProfile?.full_name || null;
  const greetingInitials = (displayName || "").slice(0, 2).toUpperCase();

  const handleQuickAdd = (type: "Ingreso" | "Gasto" | "Inversión" | "Reembolso") => {
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

  // Últimas 40 transacciones agrupadas por fecha
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 40);

  const groupedTransactions = recentTransactions.reduce((acc, t) => {
    const key = format(new Date(t.date), "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, typeof recentTransactions>);

  const sortedDateKeys = Object.keys(groupedTransactions).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  const getDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    if (isToday(d)) return "Hoy";
    if (isYesterday(d)) return "Ayer";
    return format(d, "d MMM", { locale: es });
  };

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
        {/* Greeting */}
        <div className="flex items-center gap-3">
          {displayName && (
            <Avatar className="size-10 ring-2 ring-primary/15">
              {avatarUrl && <AvatarImage src={avatarUrl} className="object-cover" />}
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {greetingInitials}
              </AvatarFallback>
            </Avatar>
          )}
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="accent-gradient-text">{getGreeting()}</span>{displayName ? `, ${displayName}` : ""}
          </h1>
        </div>

        {/* Hero: Balance (izq) + Quick Actions 2x2 (der) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Balance Card */}
          <Card className="p-6 md:p-7 border-border/50 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Balance Total</span>
              <span className="text-xs text-muted-foreground font-mono tabular-nums capitalize">
                {format(now, "MMMM yyyy", { locale: es })}
              </span>
            </div>
            <div className={cn("mt-4 text-4xl md:text-5xl font-bold font-mono tabular-nums tracking-tight", isPrivacyMode && "privacy-blur")}>
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
            <div className="mt-5 pt-4 border-t border-border/50 space-y-3">
              <p className="text-xs text-muted-foreground font-medium capitalize">
                Este mes ({format(now, "MMM yyyy", { locale: es })})
              </p>
              <div className="grid grid-cols-3 gap-3">
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
              {(lastMonthIncome > 0 || lastMonthExpenses > 0) && (
                <p className={cn(
                  "text-[11px] text-muted-foreground/70 font-mono tabular-nums pt-1",
                  isPrivacyMode && "privacy-blur"
                )}>
                  <span className="capitalize">{format(lastMonth, "MMM", { locale: es })}</span>
                  <span className="mx-1.5 text-muted-foreground/40">·</span>
                  <span className="text-success/80">+{formatCurrency(lastMonthIncome)}</span>
                  <span className="mx-1.5 text-muted-foreground/40">·</span>
                  <span className="text-destructive/80">−{formatCurrency(lastMonthExpenses)}</span>
                </p>
              )}
            </div>
          </Card>

          {/* Quick Actions 2x2 */}
          <div className="grid grid-cols-2 grid-rows-2 gap-3 min-h-[180px] md:min-h-0">
            <Button
              onClick={() => handleQuickAdd("Ingreso")}
              className="h-full min-h-[72px] flex-col gap-1.5 border border-success/20 text-success hover:bg-success/10 hover:shadow-sm bg-transparent"
            >
              <TrendingUp className="h-5 w-5" />
              <span className="text-xs font-semibold">Ingreso</span>
            </Button>
            <Button
              onClick={() => handleQuickAdd("Gasto")}
              className="h-full min-h-[72px] flex-col gap-1.5 border border-destructive/20 text-destructive hover:bg-destructive/10 hover:shadow-sm bg-transparent"
            >
              <TrendingDown className="h-5 w-5" />
              <span className="text-xs font-semibold">Gasto</span>
            </Button>
            <Button
              onClick={() => handleQuickAdd("Inversión")}
              className="h-full min-h-[72px] flex-col gap-1.5 border border-blue/20 text-blue hover:bg-blue/10 hover:shadow-sm bg-transparent"
            >
              <PiggyBank className="h-5 w-5" />
              <span className="text-xs font-semibold">Inversión</span>
            </Button>
            <Button
              onClick={() => openReconciliation()}
              variant="outline"
              className="h-full min-h-[72px] flex-col gap-1.5 hover:bg-muted hover:shadow-sm"
            >
              <Variable className="h-5 w-5" />
              <span className="text-xs font-semibold">Conciliar</span>
            </Button>
          </div>
        </div>

        {/* Recent Transactions */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold">Recientes</h2>
              {recentTransactions.length > 0 && (
                <span className="text-[10px] font-semibold bg-muted text-muted-foreground rounded-full px-2 py-0.5 tabular-nums">
                  {recentTransactions.length}
                </span>
              )}
            </div>
            <Button
              onClick={() => navigate("/transactions")}
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs h-7 px-2.5 -mr-1"
            >
              Ver todo
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground px-5 pb-5">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No hay transacciones aún</p>
              <p className="text-xs mt-1">Agrega tu primera transacción arriba</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[360px] pb-2">
              {sortedDateKeys.map((dateKey) => (
                <div key={dateKey}>
                  {/* Sticky date header */}
                  <div className="flex items-center gap-3 px-5 py-1.5 sticky top-0 bg-card z-10 shadow-[0_1px_3px_-1px_rgba(0,0,0,0.1)]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                      {getDateLabel(dateKey)}
                    </span>
                    <div className="h-px bg-border/40 flex-1" />
                    <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                      {groupedTransactions[dateKey].length}
                    </span>
                  </div>

                  {/* Transactions for this date */}
                  {groupedTransactions[dateKey].map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between py-1.5 pl-5 pr-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={cn(
                          "w-[3px] h-[28px] rounded-full flex-shrink-0",
                          t.type === "Ingreso" && "bg-success",
                          t.type === "Gasto" && "bg-destructive",
                          t.type === "Inversión" && "bg-blue"
                        )} />
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm font-medium truncate leading-snug", isPrivacyMode && "privacy-blur")}>
                            {t.category_name}
                          </p>
                          {t.detail && (
                            <p className={cn("text-xs text-muted-foreground truncate leading-snug", isPrivacyMode && "privacy-blur")}>
                              {t.detail}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={cn(
                        "text-sm font-semibold font-mono tabular-nums ml-4 flex-shrink-0",
                        t.type === "Ingreso" && "text-success",
                        t.type === "Gasto" && "text-destructive",
                        t.type === "Inversión" && "text-blue",
                        isPrivacyMode && "privacy-blur"
                      )}>
                        {t.type === "Ingreso" ? "+" : "−"}{formatCurrency(Number(t.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Training Banner */}
        {!trainingLoading && (todaySessions.length > 0 || nextRace) && (
          <TrainingBanner
            sessions={todaySessions}
            nextRace={nextRace}
            onViewTraining={() => navigate("/training")}
            onComplete={(id) => markCompleted.mutate(id)}
            onSkip={(id) => markSkipped.mutate(id)}
          />
        )}

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
