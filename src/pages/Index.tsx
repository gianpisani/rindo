import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { useMonthlySummary } from "@/hooks/useMonthlySummary";
import { useCategoryInsights } from "@/hooks/useCategoryInsights";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Receipt,
  Eye,
  Play,
  Lightbulb,
  ChevronRight,
} from "lucide-react";
import { BankSyncModal } from "@/components/BankSyncModal";
import { useBankSyncContext } from "@/contexts/BankSyncContext";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth, subMonths, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { MonthlyStory } from "@/components/MonthlyStory";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getCategoryIcon } from "@/components/TransactionsTable";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { CategoryBreakdown } from "@/hooks/useMonthlySummary";

// ─── Donut Tooltip ──────────────────────────────────────
function DonutTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as CategoryBreakdown;
  return (
    <div className="bg-card border border-border/50 rounded-xl p-3 shadow-lg">
      <p className="font-semibold text-sm text-foreground">{data.category}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        ${data.amount.toLocaleString("es-CL")} · {data.percentage.toFixed(0)}%
      </p>
    </div>
  );
}

const Index = () => {
  const { transactions, isLoading } = useTransactions();
  const { categories } = useCategories();
  const { limits } = useCategoryLimits();
  const navigate = useNavigate();
  const { openQuickAdd, openProfileEdit } = useGlobalDrawers();
  const { isPrivacyMode } = usePrivacyMode();
  const [storyOpen, setStoryOpen] = useState(false);
  const [isBankSyncOpen, setIsBankSyncOpen] = useState(false);
  const bankSync = useBankSyncContext();
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

  // Current month summary for donut chart
  const currentMonthSummary = useMonthlySummary(transactions, categories, limits, now);

  // Category insights
  const { insights: currentInsights } = useCategoryInsights(transactions, limits, now);

  // Last month data for Monthly Story
  const lastMonth = subMonths(now, 1);
  const lastMonthSummary = useMonthlySummary(transactions, categories, limits, lastMonth);
  const hasLastMonthData = lastMonthSummary.transactionCount > 0;
  const { insights: lastMonthInsights } = useCategoryInsights(transactions, limits, lastMonth);

  // Salary for last month (Sueldo category in income)
  const lastMonthSalary = useMemo(() => {
    return lastMonthTransactions
      .filter((t) => t.type === "Ingreso" && t.category_name.toLowerCase() === "sueldo")
      .reduce((s, t) => s + Number(t.amount), 0);
  }, [lastMonthTransactions]);

  // Donut chart data (top 5 + others)
  const donutData = useMemo(() => {
    const breakdown = currentMonthSummary.categoryBreakdown;
    if (breakdown.length <= 6) return breakdown;
    const top5 = breakdown.slice(0, 5);
    const others = breakdown.slice(5);
    const othersTotal = others.reduce((s, c) => s + c.amount, 0);
    const totalExp = breakdown.reduce((s, c) => s + c.amount, 0);
    return [
      ...top5,
      {
        category: "Otros",
        amount: othersTotal,
        effectiveAmount: othersTotal,
        reimbursedAmount: 0,
        percentage: totalExp > 0 ? (othersTotal / totalExp) * 100 : 0,
        color: "#94a3b8",
        count: others.reduce((s, c) => s + c.count, 0),
        prevAmount: 0,
        trend: "stable" as const,
        trendPercentage: 0,
        isOverLimit: false,
        isNearLimit: false,
      },
    ];
  }, [currentMonthSummary.categoryBreakdown]);

  const donutTotal = donutData.reduce((s, c) => s + c.amount, 0);

  const formatCompact = (value: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      notation: "compact",
    }).format(value);

  function getCatEmoji(categoryName: string) {
    const cat = categories.find((c) => c.name === categoryName);
    return cat?.icon || getCategoryIcon(categoryName);
  }

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

  // Insight type → gradient color for icon background
  const insightGradient: Record<string, string> = {
    alert: "from-amber-500/25 to-transparent",
    achievement: "from-emerald-500/25 to-transparent",
    opportunity: "from-sky-500/25 to-transparent",
    pattern: "from-violet-500/25 to-transparent",
  };
  const insightBorder: Record<string, string> = {
    alert: "border-amber-500/20",
    achievement: "border-emerald-500/20",
    opportunity: "border-sky-500/20",
    pattern: "border-violet-500/20",
  };

  // ─── Balance Card (shared between mobile/desktop) ─────
  const balanceCard = (
    <Card className="border-border/50 flex flex-col overflow-hidden">
      <div className="px-4 py-3 md:px-5 md:py-4 flex flex-col">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Balance Total</span>
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums capitalize">
            {format(now, "MMMM yyyy", { locale: es })}
          </span>
        </div>
        <div className={cn("mt-1.5 md:mt-2 text-[28px] md:text-4xl font-bold font-mono tabular-nums tracking-tight leading-none", isPrivacyMode && "privacy-blur")}>
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
        <div className="mt-2.5 pt-2.5 md:mt-3 md:pt-3 border-t border-border/50">
          <div className="flex items-center gap-3 md:gap-6 flex-wrap">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-success shrink-0" />
              <span className={cn("text-xs md:text-sm font-semibold font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                ${new Intl.NumberFormat("es-CL").format(currentIncome)}
              </span>
              {incomeChange !== 0 && (
                <span className={cn(
                  "text-[9px] md:text-[10px]",
                  incomeChange > 0 ? "text-success" : "text-destructive",
                  isPrivacyMode && "privacy-blur"
                )}>
                  {incomeChange > 0 ? "+" : ""}{Math.round(incomeChange)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-destructive shrink-0" />
              <span className={cn("text-xs md:text-sm font-semibold font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                ${new Intl.NumberFormat("es-CL").format(currentExpenses)}
              </span>
              {expenseChange !== 0 && (
                <span className={cn(
                  "text-[9px] md:text-[10px]",
                  expenseChange > 0 ? "text-destructive" : "text-success",
                  isPrivacyMode && "privacy-blur"
                )}>
                  {expenseChange > 0 ? "+" : ""}{Math.round(expenseChange)}%
                </span>
              )}
            </div>
            {currentInvestments > 0 && (
              <div className="flex items-center gap-1">
                <PiggyBank className="h-3 w-3 text-blue shrink-0" />
                <span className={cn("text-xs md:text-sm font-semibold font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                  ${new Intl.NumberFormat("es-CL").format(currentInvestments)}
                </span>
              </div>
            )}
          </div>
          {(lastMonthIncome > 0 || lastMonthExpenses > 0) && (
            <p className={cn(
              "text-[10px] text-muted-foreground font-mono tabular-nums mt-1.5 md:mt-2",
              isPrivacyMode && "privacy-blur"
            )}>
              <span className="capitalize">{format(lastMonth, "MMM", { locale: es })}</span>
              <span className="mx-1 text-muted-foreground/40">&middot;</span>
              <span className="text-success/80">+{formatCurrency(lastMonthIncome)}</span>
              <span className="mx-1 text-muted-foreground/40">&middot;</span>
              <span className="text-destructive/80">&minus;{formatCurrency(lastMonthExpenses)}</span>
            </p>
          )}
        </div>
      </div>
    </Card>
  );

  // ─── Quick Actions (shared) ───────────────────────────
  const quickActions = (
    <div className="grid grid-cols-4 lg:grid-cols-2 gap-1.5 md:gap-2">
      <Button
        onClick={() => handleQuickAdd("Ingreso")}
        className="h-auto py-2.5 md:py-5 flex-col gap-0.5 md:gap-1.5 border border-success/30 dark:border-success/20 text-success hover:bg-success/10 hover:border-success/40 hover:shadow-sm bg-transparent transition-all"
      >
        <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
        <span className="text-[10px] md:text-xs font-semibold">Ingreso</span>
      </Button>
      <Button
        onClick={() => handleQuickAdd("Gasto")}
        className="h-auto py-2.5 md:py-5 flex-col gap-0.5 md:gap-1.5 border border-destructive/30 dark:border-destructive/20 text-destructive hover:bg-destructive/10 hover:border-destructive/40 hover:shadow-sm bg-transparent transition-all"
      >
        <TrendingDown className="h-4 w-4 md:h-5 md:w-5" />
        <span className="text-[10px] md:text-xs font-semibold">Gasto</span>
      </Button>
      <Button
        onClick={() => handleQuickAdd("Inversión")}
        className="h-auto py-2.5 md:py-5 flex-col gap-0.5 md:gap-1.5 border border-blue/30 dark:border-blue/20 text-blue hover:bg-blue/10 hover:border-blue/40 hover:shadow-sm bg-transparent transition-all"
      >
        <PiggyBank className="h-4 w-4 md:h-5 md:w-5" />
        <span className="text-[10px] md:text-xs font-semibold">Inversión</span>
      </Button>
      <Button
        onClick={() => setIsBankSyncOpen(true)}
        className="h-auto py-2.5 md:py-5 flex-col gap-0.5 md:gap-1.5 border border-primary/30 dark:border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/40 hover:shadow-sm bg-transparent transition-all group overflow-hidden"
      >
        <div className="flex items-center justify-center h-4 md:h-5">
          <div className="flex -space-x-1.5 md:-space-x-[6px]">
            {["/banks/bchile.png", "/banks/santander.png", "/banks/bci.png", "/banks/bestado.png", "/banks/itau.png"].map((logo, i) => (
              <img
                key={logo}
                src={logo}
                alt=""
                className="size-4 md:size-5 rounded-full ring-[1.5px] ring-card object-contain bg-card"
                style={{ zIndex: 5 - i }}
              />
            ))}
          </div>
        </div>
        <span className="text-[10px] md:text-xs font-semibold">Sincronizar</span>
      </Button>
    </div>
  );

  // ─── Donut Chart Card (desktop top row) ────────────────
  const donutCard = (
    <Card className="border-border/50 overflow-hidden flex flex-col h-full">
      <div className="px-3 pt-2.5 pb-0">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Gastos del mes
        </span>
      </div>
      {donutData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">Sin gastos</p>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center gap-3 px-3 pb-2 min-h-0">
          {/* Donut */}
          <div className="relative shrink-0 w-[110px] h-[110px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  paddingAngle={2}
                  strokeWidth={0}
                  className={cn(isPrivacyMode && "privacy-blur")}
                >
                  {donutData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.color}
                      className="transition-opacity hover:opacity-80 cursor-pointer"
                    />
                  ))}
                </Pie>
                <ChartTooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className={cn(
                "text-[10px] font-bold font-mono tabular-nums",
                isPrivacyMode && "privacy-blur"
              )}>
                {formatCompact(donutTotal)}
              </p>
            </div>
          </div>
          {/* Legend */}
          <div className="space-y-0.5 overflow-hidden">
            {donutData.map((cat) => (
              <div key={cat.category} className="flex items-center gap-1.5 min-w-0">
                <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-[10px] text-muted-foreground truncate">
                  {getCatEmoji(cat.category)} {cat.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );

  // ─── Insights Panel (desktop) ─────────────────────────
  const topInsights = currentInsights.slice(0, 6);
  const insightsPanel = (
    <Card className="border-border/50 overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Insights</h2>
          {currentInsights.length > 0 && (
            <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
              {currentInsights.length}
            </span>
          )}
        </div>
        <Button
          onClick={() => navigate("/overview")}
          variant="ghost"
          size="sm"
          className="gap-1 text-[11px] h-6 px-2 -mr-1"
        >
          Ver más
          <Eye className="h-3 w-3" />
        </Button>
      </div>
      {topInsights.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-4 px-3">
          <p className="text-xs text-muted-foreground">Sin insights aún</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
          {topInsights.map((insight, i) => {
            const emoji = insight.category ? getCatEmoji(insight.category) : "💡";
            const gradient = insightGradient[insight.type] || insightGradient.pattern;
            const border = insightBorder[insight.type] || insightBorder.pattern;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors hover:brightness-110",
                  border
                )}
              >
                <span className="text-base shrink-0 flex items-center justify-center size-7">{emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium leading-snug">{insight.title}</p>
                  <p className={cn("text-[10px] text-muted-foreground leading-snug mt-0.5", isPrivacyMode && "privacy-blur")}>
                    {insight.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );

  // ─── Transactions Card (shared) ───────────────────────
  const transactionsCard = (
    <Card className="overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
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
        <div className="overflow-y-auto flex-1 pb-2">
          {sortedDateKeys.map((dateKey) => (
            <div key={dateKey}>
              <div className="flex items-center gap-3 px-5 py-1.5 sticky top-0 bg-card z-10 shadow-[0_1px_3px_-1px_rgba(0,0,0,0.1)]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                  {getDateLabel(dateKey)}
                </span>
                <div className="h-px bg-border/40 flex-1" />
                <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                  {groupedTransactions[dateKey].length}
                </span>
              </div>
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
  );

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

        {/* ─── MOBILE LAYOUT (< lg) ─── */}
        {/* 100dvh minus: header 56px + main-padding 16px + greeting ~36px + gap 16px + bottom-padding 112px */}
        <div className="lg:hidden flex flex-col gap-3" style={{ height: "calc(100dvh - 236px)" }}>
          {/* Balance + Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-[3fr,2fr] gap-3 shrink-0">
            {balanceCard}
            {quickActions}
          </div>
          {/* Transactions — scrolls internally */}
          <div className="flex-1 min-h-0">
            {transactionsCard}
          </div>
          {/* Monthly Story — always visible at bottom */}
          {hasLastMonthData && (
            <button
              onClick={() => setStoryOpen(true)}
              className="shrink-0 w-full group relative overflow-hidden rounded-xl border border-border/50 px-4 py-3 text-left transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
                    <Play className="h-3.5 w-3.5 ml-0.5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold capitalize leading-tight">
                      Resumen de {format(lastMonth, "MMMM", { locale: es })}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {lastMonthSummary.transactionCount} transacciones
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          )}
        </div>

        {/* ─── DESKTOP LAYOUT (lg+) ─── */}
        <div className="hidden lg:block space-y-3">
          {/* Top row: Balance | Donut | Quick Actions */}
          <div className="grid grid-cols-12 gap-3 items-stretch">
            <div className="col-span-5">{balanceCard}</div>
            <div className="col-span-3 min-h-0">{donutCard}</div>
            <div className="col-span-4">{quickActions}</div>
          </div>

          {/* Bottom row: Transactions | Insights — fills remaining viewport */}
          <div className="grid grid-cols-12 gap-3 items-stretch" style={{ height: "calc(100vh - 340px)", minHeight: 260 }}>
            <div className="col-span-8 min-h-0">{transactionsCard}</div>
            <div className="col-span-4 min-h-0">{insightsPanel}</div>
          </div>
        </div>

        <BankSyncModal
          open={isBankSyncOpen}
          onOpenChange={setIsBankSyncOpen}
          syncStep={bankSync.step}
          pollStatus={bankSync.pollStatus}
          result={bankSync.result}
          onStart={bankSync.startSync}
          onImportSkipped={bankSync.importSkipped}
          onReset={bankSync.reset}
        />

        {/* Monthly Story - Last month review (desktop only, mobile version is inline above) */}
        {hasLastMonthData && (
          <button
            onClick={() => setStoryOpen(true)}
            className="hidden lg:block w-full group relative overflow-hidden rounded-xl border border-border/50 p-5 text-left transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
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
        salary={lastMonthSalary}
        insights={lastMonthInsights}
      />
    </Layout>
  );
};

export default Index;
