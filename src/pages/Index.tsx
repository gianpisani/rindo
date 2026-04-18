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
import { Skeleton } from "@/components/ui/skeleton";
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
  const { transactions, isLoading } = useTransactions();
  const { categories } = useCategories();
  const { limits } = useCategoryLimits();
  const navigate = useNavigate();
  const { openQuickAdd, openReconciliation, openProfileEdit } = useGlobalDrawers();
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
      <div className="space-y-4">
        {/* Greeting — compact */}
        <div className="flex items-center gap-2.5">
          {displayName && (
            <button onClick={() => openProfileEdit()} className="focus:outline-none group">
              <div className="rounded-full p-[2px] accent-gradient-bg transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_16px_var(--primary)]">
                <Avatar className="size-8">
                  {avatarUrl && <AvatarImage src={avatarUrl} className="object-cover" />}
                  <AvatarFallback className="bg-background text-primary text-xs font-semibold">
                    {greetingInitials}
                  </AvatarFallback>
                </Avatar>
              </div>
            </button>
          )}
          <h1 className="text-xl font-bold tracking-tight">
            {getGreeting()}{displayName ? <>, <span className="animated-gradient-text">{displayName}</span></> : ""}
          </h1>
        </div>

        {/* Hero: Balance (izq) + Quick Actions 2x2 (der) */}
        <div className="grid grid-cols-1 md:grid-cols-[3fr,2fr] gap-3">
          {/* Balance Card — compact */}
          <Card className="border-border/50 flex flex-col overflow-hidden">
            <div className="h-[2px] accent-gradient-bg" />
            <div className="px-5 py-4 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Balance Total</span>
              <span className="text-[10px] text-muted-foreground font-mono tabular-nums capitalize">
                {format(now, "MMMM yyyy", { locale: es })}
              </span>
            </div>
            <div className={cn("mt-2 text-3xl md:text-4xl font-bold font-mono tabular-nums tracking-tight", isPrivacyMode && "privacy-blur")}>
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
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="flex items-center gap-4 md:gap-6">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3 text-success" />
                  <span className={cn("text-sm font-semibold font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                    ${new Intl.NumberFormat("es-CL").format(currentIncome)}
                  </span>
                  {incomeChange !== 0 && (
                    <span className={cn(
                      "text-[10px]",
                      incomeChange > 0 ? "text-success" : "text-destructive",
                      isPrivacyMode && "privacy-blur"
                    )}>
                      {incomeChange > 0 ? "+" : ""}{Math.round(incomeChange)}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="h-3 w-3 text-destructive" />
                  <span className={cn("text-sm font-semibold font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                    ${new Intl.NumberFormat("es-CL").format(currentExpenses)}
                  </span>
                  {expenseChange !== 0 && (
                    <span className={cn(
                      "text-[10px]",
                      expenseChange > 0 ? "text-destructive" : "text-success",
                      isPrivacyMode && "privacy-blur"
                    )}>
                      {expenseChange > 0 ? "+" : ""}{Math.round(expenseChange)}%
                    </span>
                  )}
                </div>
                {currentInvestments > 0 && (
                  <div className="flex items-center gap-1.5">
                    <PiggyBank className="h-3 w-3 text-blue" />
                    <span className={cn("text-sm font-semibold font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                      ${new Intl.NumberFormat("es-CL").format(currentInvestments)}
                    </span>
                  </div>
                )}
              </div>
              {(lastMonthIncome > 0 || lastMonthExpenses > 0) && (
                <p className={cn(
                  "text-[10px] text-muted-foreground font-mono tabular-nums mt-2",
                  isPrivacyMode && "privacy-blur"
                )}>
                  <span className="capitalize">{format(lastMonth, "MMM", { locale: es })}</span>
                  <span className="mx-1 text-muted-foreground/40">·</span>
                  <span className="text-success/80">+{formatCurrency(lastMonthIncome)}</span>
                  <span className="mx-1 text-muted-foreground/40">·</span>
                  <span className="text-destructive/80">−{formatCurrency(lastMonthExpenses)}</span>
                </p>
              )}
            </div>
            </div>
          </Card>

          {/* Quick Actions 2x2 */}
          <div className="grid grid-cols-4 md:grid-cols-2 gap-2">
            <Button
              onClick={() => handleQuickAdd("Ingreso")}
              className="h-auto py-3 md:py-4 flex-col gap-1 border border-success/20 text-success hover:bg-success/10 hover:border-success/30 hover:shadow-sm bg-transparent transition-all"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="text-[11px] font-semibold">Ingreso</span>
            </Button>
            <Button
              onClick={() => handleQuickAdd("Gasto")}
              className="h-auto py-3 md:py-4 flex-col gap-1 border border-destructive/20 text-destructive hover:bg-destructive/10 hover:border-destructive/30 hover:shadow-sm bg-transparent transition-all"
            >
              <TrendingDown className="h-4 w-4" />
              <span className="text-[11px] font-semibold">Gasto</span>
            </Button>
            <Button
              onClick={() => handleQuickAdd("Inversión")}
              className="h-auto py-3 md:py-4 flex-col gap-1 border border-blue/20 text-blue hover:bg-blue/10 hover:border-blue/30 hover:shadow-sm bg-transparent transition-all"
            >
              <PiggyBank className="h-4 w-4" />
              <span className="text-[11px] font-semibold">Inversión</span>
            </Button>
            <Button
              onClick={() => openReconciliation()}
              variant="outline"
              className="h-auto py-3 md:py-4 flex-col gap-1 hover:bg-muted hover:border-border hover:shadow-sm transition-all"
            >
              <Variable className="h-4 w-4" />
              <span className="text-[11px] font-semibold">Conciliar</span>
            </Button>
          </div>
        </div>

        {/* Recent Transactions */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Recientes</h2>
              {recentTransactions.length > 0 && (
                <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                  {recentTransactions.length}
                </span>
              )}
            </div>
            <Button
              onClick={() => navigate("/transactions")}
              variant="ghost"
              size="sm"
              className="gap-1 text-[11px] h-6 px-2 -mr-1"
            >
              Ver todo
              <Eye className="h-3 w-3" />
            </Button>
          </div>

          {isLoading ? (
            <div className="px-5 pb-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="w-[3px] h-[28px] rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="py-14 text-center px-5 pb-5">
              <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-muted/50 mb-4">
                <Receipt className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No hay transacciones aún</p>
              <p className="text-xs text-muted-foreground mt-1">Agrega tu primera transacción arriba</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[450px] pb-2">
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
