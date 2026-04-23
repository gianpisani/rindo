import { useState, useMemo, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import { GlassCard } from "@/components/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { useMonthlyBudget } from "@/hooks/useMonthlyBudget";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import {
  useMonthlySummary,
  type CategoryBreakdown,
} from "@/hooks/useMonthlySummary";
import { CHART_COLORS } from "@/lib/chart-config";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  isSameMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Wallet,
  CalendarDays,
  Info,
  Target,
  CreditCard,
  ArrowRight,
  Play,
  Trophy,
  Calendar,
  Flame,
} from "lucide-react";
import { MonthlyStory } from "@/components/MonthlyStory";
import { MonthlyEvolutionChart } from "@/components/MonthlyEvolutionChart";
import ProjectionCard from "@/components/ProjectionCard";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { getCategoryIcon } from "@/components/TransactionsTable";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoryDetailModal } from "@/components/CategoryDetailModal";
import { useCategoryInsights, type CategorySpending } from "@/hooks/useCategoryInsights";

// ─── Formatters ──────────────────────────────────────────

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatCompact = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    notation: "compact",
  }).format(value);

// ─── Custom Tooltips ─────────────────────────────────────

function DonutTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as CategoryBreakdown;
  return (
    <div className="bg-card border border-border/50 rounded-xl p-3 shadow-lg">
      <p className="font-semibold text-sm text-foreground">{data.category}</p>
      <p
        className="text-sm font-mono tabular-nums font-semibold"
        style={{ color: data.color }}
      >
        {formatCurrency(data.amount)}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {data.percentage.toFixed(1)}% del total
      </p>
    </div>
  );
}

// ─── Category Emoji Helper ───────────────────────────────

function getCatEmoji(categoryName: string, categories: { name: string; icon: string | null }[]) {
  const cat = categories.find((c) => c.name === categoryName);
  return cat?.icon || getCategoryIcon(categoryName);
}

// ─── Section Card ────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  tooltip,
  children,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  tooltip?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2 px-4 pt-3 pb-1.5 border-b border-border/20">
        {Icon && <Icon className="h-3 w-3 text-primary/60" />}
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex-1 p-4 pt-3">{children}</div>
    </GlassCard>
  );
}

// ─── KPI Card ────────────────────────────────────────────

interface KPICardProps {
  label: string;
  icon: LucideIcon;
  value: number;
  prev: number;
  iconColor: string;
  iconBg: string;
  gradient: string;
  invertDelta: boolean;
  prevMonthLabel: string;
  isPrivacyMode: boolean;
}

function KPICard({
  label,
  icon: Icon,
  value,
  prev,
  iconColor,
  iconBg,
  gradient,
  invertDelta,
  prevMonthLabel,
  isPrivacyMode,
}: KPICardProps) {
  const rawDelta = prev !== 0 ? ((value - prev) / Math.abs(prev)) * 100 : 0;
  const delta = Math.max(-999, Math.min(999, rawDelta));
  const isPositive = delta > 0;
  const isGood = invertDelta ? !isPositive : isPositive;
  // Hide delta if prev was 0, or if the change is absurdly large (>500%) — not useful info
  const showDelta = prev !== 0 && Math.abs(rawDelta) <= 500;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <GlassCard className="relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200">
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-br to-transparent",
                gradient
              )}
            />
            <div className="relative p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <div className={cn("p-1 rounded-md", iconBg)}>
                  <Icon className={cn("h-3 w-3", iconColor)} />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {label}
                </span>
              </div>
              <div
                className={cn(
                  "text-xl font-bold font-mono tabular-nums",
                  isPrivacyMode && "privacy-blur"
                )}
              >
                $
                <NumberFlow
                  value={value}
                  format={{
                    style: "decimal",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }}
                  locales="es-CL"
                />
              </div>
              {showDelta && (
                <div className="mt-1.5 flex items-center gap-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 text-[10px] font-semibold px-1 py-0.5 rounded",
                      isGood
                        ? "text-emerald-600 bg-emerald-500/10"
                        : "text-rose-600 bg-rose-500/10"
                    )}
                  >
                    {isPositive ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    vs anterior
                  </span>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">
          {prevMonthLabel}: {formatCurrency(prev)}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Comparison Helper ───────────────────────────────────

function makeComparison(
  label: string,
  current: number,
  previous: number,
  color: string,
  lowerIsBetter: boolean
) {
  const delta =
    previous > 0 ? ((current - previous) / previous) * 100 : 0;
  return {
    label,
    current,
    previous,
    color,
    delta,
    isGood: lowerIsBetter ? delta <= 0 : delta >= 0,
  };
}

// ─── Main Component ──────────────────────────────────────

export default function Overview() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [storyOpen, setStoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("mes");
  const { transactions, isLoading } = useTransactions();
  const { categories } = useCategories();
  const { limits } = useCategoryLimits();
  const { budget } = useMonthlyBudget();
  const { creditCards, cardSummaries, totals: cardTotals } = useCreditCards();
  const { isPrivacyMode } = usePrivacyMode();
  const monthStripRef = useRef<HTMLDivElement>(null);

  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<CategorySpending | null>(null);

  useEffect(() => {
    setExcludedCategories(new Set());
  }, [format(selectedMonth, "yyyy-MM")]);

  const toggleCategory = (cat: string) => {
    setExcludedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const { kpis, categoryBreakdown, dailySpending, dailyStats, cardSpending, transactionCount, budgetSummary } =
    useMonthlySummary(transactions, categories, limits, selectedMonth, budget?.total_budget, excludedCategories);

  const { insights: storyInsights } = useCategoryInsights(transactions, limits, selectedMonth);

  // Salary for selected month
  const storySalary = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    return transactions
      .filter((t) => {
        const d = new Date(t.date);
        return t.type === "Ingreso" && t.category_name.toLowerCase() === "sueldo" && d >= monthStart && d <= monthEnd;
      })
      .reduce((s, t) => s + Number(t.amount), 0);
  }, [transactions, selectedMonth]);

  const isCurrentMonth = isSameMonth(selectedMonth, new Date());

  // All historical months (from earliest transaction to now)
  const allMonths = useMemo(() => {
    if (transactions.length === 0) {
      return eachMonthOfInterval({
        start: subMonths(new Date(), 5),
        end: new Date(),
      });
    }
    const earliest = transactions.reduce((min, t) => {
      const d = new Date(t.date);
      return d < min ? d : min;
    }, new Date());
    return eachMonthOfInterval({
      start: startOfMonth(earliest),
      end: new Date(),
    });
  }, [transactions]);

  // Month pills — all historical months
  const monthPills = allMonths;

  // Scroll active pill into view
  useEffect(() => {
    if (monthStripRef.current) {
      const active = monthStripRef.current.querySelector("[data-active=true]");
      active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selectedMonth, monthPills]);

  const openCategoryDetail = (cat: (typeof categoryBreakdown)[number]) => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    const catTxns = transactions.filter((t) => {
      const d = new Date(t.date);
      return t.category_name === cat.category && d >= start && d <= end;
    });
    setSelectedCategory({
      category: cat.category,
      amount: cat.amount,
      effectiveAmount: cat.effectiveAmount,
      reimbursedAmount: cat.reimbursedAmount,
      count: cat.count,
      percentage: cat.percentage,
      limit: cat.limit,
      isOverLimit: cat.isOverLimit,
      isNearLimit: cat.isNearLimit,
      trend: cat.trend,
      trendPercentage: cat.trendPercentage,
      transactions: catTxns,
    });
  };

  const prevMonthLabel = format(subMonths(selectedMonth, 1), "MMMM yyyy", {
    locale: es,
  });

  // KPI card configs
  const kpiCards = [
    {
      label: "Ingresos",
      icon: TrendingUp,
      value: kpis.income,
      prev: kpis.prevIncome,
      iconColor: "text-emerald-500",
      iconBg: "bg-emerald-500/10",
      gradient: "from-emerald-500/[0.03]",
      invertDelta: false,
    },
    {
      label: "Gastos",
      icon: TrendingDown,
      value: kpis.expenses,
      prev: kpis.prevExpenses,
      iconColor: "text-rose-500",
      iconBg: "bg-rose-500/10",
      gradient: "from-rose-500/[0.03]",
      invertDelta: true,
    },
    {
      label: "Inversiones",
      icon: PiggyBank,
      value: kpis.investments,
      prev: kpis.prevInvestments,
      iconColor: "text-sky-500",
      iconBg: "bg-sky-500/10",
      gradient: "from-sky-500/[0.03]",
      invertDelta: false,
    },
    {
      label: "Balance",
      icon: Wallet,
      value: kpis.balance,
      prev: kpis.prevBalance,
      iconColor:
        kpis.balance >= 0 ? "text-emerald-500" : "text-rose-500",
      iconBg:
        kpis.balance >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10",
      gradient:
        kpis.balance >= 0
          ? "from-emerald-500/[0.03]"
          : "from-rose-500/[0.03]",
      invertDelta: false,
    },
  ];

  // Filtered breakdown (excludes toggled-off categories, recalculates percentages)
  const filteredCategoryBreakdown = useMemo(() => {
    const included = categoryBreakdown.filter((c) => !excludedCategories.has(c.category));
    const total = included.reduce((s, c) => s + c.amount, 0);
    return included.map((c) => ({
      ...c,
      percentage: total > 0 ? (c.amount / total) * 100 : 0,
    }));
  }, [categoryBreakdown, excludedCategories]);

  const filteredTotal = filteredCategoryBreakdown.reduce((s, c) => s + c.amount, 0);

  // Donut chart data (top 5 + others), using filtered breakdown
  const donutData = useMemo(() => {
    if (filteredCategoryBreakdown.length <= 6) return filteredCategoryBreakdown;
    const top5 = filteredCategoryBreakdown.slice(0, 5);
    const others = filteredCategoryBreakdown.slice(5);
    const othersTotal = others.reduce((s, c) => s + c.amount, 0);
    const totalExp = filteredCategoryBreakdown.reduce((s, c) => s + c.amount, 0);
    return [
      ...top5,
      {
        category: "Otros",
        amount: othersTotal,
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
  }, [filteredCategoryBreakdown]);

  // Comparison data
  const comparisonData = [
    makeComparison("Ingresos", kpis.income, kpis.prevIncome, CHART_COLORS.income, false),
    makeComparison("Gastos", kpis.expenses, kpis.prevExpenses, CHART_COLORS.expense, true),
    makeComparison("Inversiones", kpis.investments, kpis.prevInvestments, CHART_COLORS.investment, false),
  ];

  // Credit cards used this month
  const monthlyCardSpending = creditCards
    .filter((c) => c.is_active)
    .map((c) => ({ ...c, spent: cardSpending.get(c.id) || 0 }))
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  // Summary insight
  const summaryInsight = useMemo(() => {
    if (kpis.prevExpenses === 0 && kpis.prevIncome === 0) return null;
    const diff = kpis.expenses - kpis.prevExpenses;
    if (Math.abs(diff) < 1000) return null;
    return {
      text:
        diff < 0
          ? `Gastaste ${formatCurrency(Math.abs(diff))} menos que en ${format(subMonths(selectedMonth, 1), "MMMM", { locale: es })}`
          : `Gastaste ${formatCurrency(diff)} más que en ${format(subMonths(selectedMonth, 1), "MMMM", { locale: es })}`,
      isGood: diff <= 0,
    };
  }, [kpis, selectedMonth]);

  // ─── Histórico data ───────────────────────────────────

  const monthlyData = useMemo(() => {
    return allMonths.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const monthTxns = transactions.filter((t) => {
        const date = new Date(t.date);
        return date >= monthStart && date <= monthEnd;
      });
      const income = monthTxns
        .filter((t) => t.type === "Ingreso")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const expenses = monthTxns
        .filter((t) => t.type === "Gasto")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const investments = monthTxns
        .filter((t) => t.type === "Inversión")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      return {
        month: format(month, "MMM yy", { locale: es }),
        Ingresos: income,
        Gastos: expenses,
        Inversiones: investments,
        Balance: income - expenses - investments,
      };
    });
  }, [allMonths, transactions]);

  // Historical aggregate stats (independent of selectedMonth)
  const historicalStats = useMemo(() => {
    const monthMap = new Map<string, { income: number; expenses: number; investments: number }>();
    for (const t of transactions) {
      const key = format(new Date(t.date), "yyyy-MM");
      if (!monthMap.has(key)) monthMap.set(key, { income: 0, expenses: 0, investments: 0 });
      const entry = monthMap.get(key)!;
      const amount = Number(t.amount);
      if (t.type === "Ingreso") entry.income += amount;
      else if (t.type === "Gasto") entry.expenses += amount;
      else if (t.type === "Inversión") entry.investments += amount;
    }

    const months = Array.from(monthMap.entries());
    const n = months.length || 1;
    const totals = months.reduce(
      (acc, [, v]) => ({
        income: acc.income + v.income,
        expenses: acc.expenses + v.expenses,
        investments: acc.investments + v.investments,
      }),
      { income: 0, expenses: 0, investments: 0 }
    );

    let bestMonth: { name: string; balance: number } | null = null;
    let worstMonth: { name: string; balance: number } | null = null;
    for (const [key, v] of months) {
      const balance = v.income - v.expenses - v.investments;
      const date = new Date(key + "-15");
      const name = format(date, "MMMM yyyy", { locale: es });
      if (!bestMonth || balance > bestMonth.balance) bestMonth = { name, balance };
      if (!worstMonth || balance < worstMonth.balance) worstMonth = { name, balance };
    }

    const totalLiquid = totals.income - totals.expenses - totals.investments;
    const totalInvested = totals.investments;
    const patrimonio = totals.income - totals.expenses;
    const savingsRate = totals.income > 0
      ? ((totals.income - totals.expenses) / totals.income) * 100
      : 0;

    return {
      monthsWithData: months.length,
      avgIncome: totals.income / n,
      avgExpenses: totals.expenses / n,
      avgInvestments: totals.investments / n,
      avgBalance: (totals.income - totals.expenses - totals.investments) / n,
      patrimonio,
      totalLiquid,
      totalInvested,
      totalIncome: totals.income,
      totalExpenses: totals.expenses,
      savingsRate,
      bestMonth: months.length >= 2 ? bestMonth : null,
      worstMonth: months.length >= 2 ? worstMonth : null,
    };
  }, [transactions]);

  // Expenses by category (for horizontal bar chart in Histórico tab)
  const expensesByCategory = useMemo(() => {
    return transactions
      .filter((t) => t.type === "Gasto")
      .reduce((acc, t) => {
        const existing = acc.find((item) => item.name === t.category_name);
        if (existing) {
          existing.value += Number(t.amount);
        } else {
          const category = categories.find((c) => c.name === t.category_name);
          acc.push({
            name: t.category_name,
            value: Number(t.amount),
            color: category?.color || "#ef4444",
          });
        }
        return acc;
      }, [] as { name: string; value: number; color: string }[])
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [transactions, categories]);

  const hasBudget = (budgetSummary?.totalBudget ?? 0) > 0;

  return (
    <Layout>
      <div className="space-y-4">
        {/* ─── Header ────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">
              Finanzas
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "mes"
                ? isLoading
                  ? "Cargando..."
                  : `${transactionCount} movimientos en ${format(selectedMonth, "MMMM", { locale: es })}`
                : "Visión general de tu historial financiero"}
            </p>
          </div>
        </div>

        {/* ─── Tabs ──────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-9 rounded-lg bg-muted/60 p-0.5">
            <TabsTrigger value="mes" className="rounded-md text-xs px-4 data-[state=active]:shadow-sm">
              Mes
            </TabsTrigger>
            <TabsTrigger value="historico" className="rounded-md text-xs px-4 data-[state=active]:shadow-sm">
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* ════════════════════════════════════════════ */}
          {/* TAB: MES                                     */}
          {/* ════════════════════════════════════════════ */}
          <TabsContent value="mes" className="mt-4 space-y-4">
            {/* Month Strip + Story */}
            <div className="flex items-center gap-3">
              <div
                ref={monthStripRef}
                className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1"
              >
                {monthPills.map((month, idx) => {
                  const isActive = isSameMonth(month, selectedMonth);
                  const isCurrent = isSameMonth(month, new Date());
                  const prevMonth = idx > 0 ? monthPills[idx - 1] : null;
                  const showYear = !prevMonth || month.getFullYear() !== prevMonth.getFullYear();
                  return (
                    <button
                      key={format(month, "yyyy-MM")}
                      data-active={isActive}
                      onClick={() => setSelectedMonth(month)}
                      className={cn(
                        "relative flex flex-col items-center rounded-xl transition-all duration-200 shrink-0",
                        "text-center px-3 py-1.5 min-w-0",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "hover:bg-accent/60 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {showYear && (
                        <span className={cn(
                          "text-[9px] uppercase tracking-widest font-medium leading-none",
                          isActive ? "text-primary-foreground/60" : "text-muted-foreground/40"
                        )}>
                          {format(month, "yyyy")}
                        </span>
                      )}
                      <span className={cn(
                        "text-[13px] font-semibold capitalize leading-tight",
                        isActive ? "text-primary-foreground" : ""
                      )}>
                        {format(month, "MMM", { locale: es })}
                      </span>
                      {isCurrent && !isActive && (
                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Monthly Story trigger */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 shrink-0"
                    onClick={() => setStoryOpen(true)}
                    disabled={transactionCount === 0}
                  >
                    <Play className="h-3.5 w-3.5 ml-0.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Resumen del mes</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {isLoading ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 rounded-xl" />
                  ))}
                </div>
                <Skeleton className="h-12 rounded-xl" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Skeleton className="h-80 rounded-xl" />
                  <Skeleton className="h-80 rounded-xl" />
                </div>
              </div>
            ) : transactionCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground">
                  Sin movimientos
                </h3>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  No hay transacciones en{" "}
                  {format(selectedMonth, "MMMM yyyy", { locale: es })}
                </p>
              </div>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {kpiCards.map((card) => (
                    <KPICard
                      key={card.label}
                      {...card}
                      prevMonthLabel={prevMonthLabel}
                      isPrivacyMode={isPrivacyMode}
                    />
                  ))}
                </div>

                {/* ── Insights Row ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Savings Rate Ring */}
                  {(() => {
                    const showSavings = kpis.income > 0 || kpis.projectedSavingsRate !== null;
                    if (!showSavings) return <div />;
                    const isProjected = kpis.projectedSavingsRate !== null && kpis.income === 0;
                    const displayRate = isProjected ? kpis.projectedSavingsRate! : kpis.savingsRate;
                    const absRate = Math.min(Math.abs(displayRate), 100);
                    const circumference = 2 * Math.PI * 28;
                    const strokeDash = (absRate / 100) * circumference;
                    return (
                      <GlassCard className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-[68px] h-[68px] shrink-0">
                            <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
                              <circle
                                cx="32" cy="32" r="28" fill="none" strokeWidth="5" strokeLinecap="round"
                                stroke={displayRate >= 0 ? "#8b5cf6" : "#f43f5e"}
                                strokeDasharray={`${strokeDash} ${circumference}`}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className={cn(
                                "text-sm font-bold font-mono tabular-nums",
                                displayRate >= 0 ? "text-violet-500" : "text-rose-500",
                                isPrivacyMode && "privacy-blur"
                              )}>
                                {displayRate.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                              {isProjected ? "Ahorro (proy.)" : "Tasa de Ahorro"}
                            </p>
                            <div className={cn(
                              "text-lg font-bold font-mono tabular-nums",
                              displayRate >= 0 ? "text-violet-500" : "text-rose-500",
                              isPrivacyMode && "privacy-blur"
                            )}>
                              <NumberFlow value={displayRate} format={{ maximumFractionDigits: 1 }} />%
                            </div>
                            {kpis.prevSavingsRate !== 0 && (
                              <p className={cn("text-[10px] text-muted-foreground font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                                Ant: {kpis.prevSavingsRate.toFixed(1)}%
                              </p>
                            )}
                          </div>
                        </div>
                      </GlassCard>
                    );
                  })()}

                  {/* Daily Spending Stats */}
                  {dailySpending.length > 0 ? (
                    <GlassCard className="p-4">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">
                        Gasto Diario
                      </p>
                      <div className={cn("text-lg font-bold font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                        {formatCompact(dailyStats.avgDaily)}
                        <span className="text-xs font-normal text-muted-foreground">/día</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                        {dailyStats.peakDay && (
                          <span className="flex items-center gap-1">
                            <Flame className="h-3 w-3 text-orange-500" />
                            <span className={cn("font-semibold text-foreground font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                              {formatCompact(dailyStats.peakDay.amount)}
                            </span>
                          </span>
                        )}
                        <span>
                          📅 {dailyStats.daysWithSpending}/{dailyStats.totalDays} días
                        </span>
                      </div>
                    </GlassCard>
                  ) : <div />}

                  {/* Credit Cards Mini */}
                  {monthlyCardSpending.length > 0 ? (
                    <GlassCard className="p-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                          Tarjetas
                        </p>
                        <Link to="/credit-cards" className="text-[10px] text-primary hover:underline">
                          Ver →
                        </Link>
                      </div>
                      {cardTotals.totalLimit > 0 && (
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                            <span>Cupo usado</span>
                            <span className={cn("font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                              {Math.round((cardTotals.totalUsed / cardTotals.totalLimit) * 100)}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/70"
                              style={{ width: `${Math.min((cardTotals.totalUsed / cardTotals.totalLimit) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {monthlyCardSpending.slice(0, 3).map((card) => (
                          <div key={card.id} className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: card.color || "#6b7280" }} />
                            <span className="text-[11px] truncate flex-1">{card.name}</span>
                            <span className={cn("text-[11px] font-mono font-semibold tabular-nums shrink-0", isPrivacyMode && "privacy-blur")}>
                              {formatCompact(card.spent)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  ) : <div />}
                </div>

                {/* Donut + Comparison */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-7">
                    <SectionCard
                      title="Gastos por Categoría"
                      tooltip="Distribución de gastos del mes por categoría"
                    >
                      {categoryBreakdown.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">
                          Sin gastos registrados
                        </p>
                      ) : (
                        <div className="flex flex-col items-center">
                          <div className="relative w-full max-w-[220px]">
                            <ResponsiveContainer width="100%" height={220}>
                              <PieChart>
                                <Pie
                                  data={donutData}
                                  dataKey="amount"
                                  nameKey="category"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={90}
                                  paddingAngle={3}
                                  strokeWidth={0}
                                  className={cn(isPrivacyMode && "privacy-blur")}
                                >
                                  {donutData.map((entry, i) => (
                                    <Cell
                                      key={i}
                                      fill={entry.color}
                                      className="transition-opacity hover:opacity-80"
                                    />
                                  ))}
                                </Pie>
                                <ChartTooltip content={<DonutTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="text-center">
                                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                                  Total
                                </p>
                                <p
                                  className={cn(
                                    "text-base font-bold font-mono tabular-nums",
                                    isPrivacyMode && "privacy-blur"
                                  )}
                                >
                                  {formatCompact(filteredTotal)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
                            {donutData.map((cat) => (
                              <div
                                key={cat.category}
                                className="flex items-center gap-1"
                              >
                                <span className="text-[11px] leading-none">{getCatEmoji(cat.category, categories)}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {cat.category}
                                </span>
                                <span className="text-[10px] font-semibold tabular-nums">
                                  {cat.percentage.toFixed(0)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </SectionCard>
                  </div>

                  <div className="lg:col-span-5">
                    <SectionCard
                      title="vs Mes Anterior"
                      icon={ArrowRight}
                      tooltip={`Comparación con ${prevMonthLabel}`}
                    >
                      <div className="space-y-3">
                        {comparisonData.map((item) => {
                          const maxVal =
                            Math.max(item.current, item.previous) || 1;
                          return (
                            <div key={item.label} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium">
                                  {item.label}
                                </span>
                                <span
                                  className={cn(
                                    "text-xs font-mono font-semibold tabular-nums",
                                    isPrivacyMode && "privacy-blur"
                                  )}
                                >
                                  {formatCompact(item.current)}
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700 ease-out"
                                  style={{
                                    width: `${(item.current / maxVal) * 100}%`,
                                    backgroundColor: item.color,
                                  }}
                                />
                              </div>
                              <div className="h-1 rounded-full bg-muted/60 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700 ease-out opacity-35"
                                  style={{
                                    width: `${(item.previous / maxVal) * 100}%`,
                                    backgroundColor: item.color,
                                  }}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <span
                                  className={cn(
                                    "text-[9px] text-muted-foreground",
                                    isPrivacyMode && "privacy-blur"
                                  )}
                                >
                                  {format(
                                    subMonths(selectedMonth, 1),
                                    "MMM",
                                    { locale: es }
                                  )}
                                  : {formatCompact(item.previous)}
                                </span>
                                {item.delta !== 0 && (
                                  <span
                                    className={cn(
                                      "text-[10px] font-semibold",
                                      item.isGood
                                        ? "text-emerald-500"
                                        : "text-rose-500"
                                    )}
                                  >
                                    {item.delta > 0 ? "+" : ""}
                                    {item.delta.toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {summaryInsight && (
                          <div
                            className={cn(
                              "mt-2 px-2.5 py-2 rounded-lg text-[11px] font-medium border",
                              summaryInsight.isGood
                                ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600"
                                : "bg-rose-500/5 border-rose-500/20 text-rose-600"
                            )}
                          >
                            {summaryInsight.text}
                          </div>
                        )}
                      </div>
                    </SectionCard>
                  </div>
                </div>


                {/* Gastos + Presupuesto side by side */}
                {categoryBreakdown.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Gastos por Categoría */}
                    <SectionCard title="Gastos por Categoría">
                      <div className="space-y-0.5">
                        {/* Select all header */}
                        <div className="flex items-center gap-2 pb-1 mb-0.5 border-b border-border/40">
                          <Checkbox
                            checked={excludedCategories.size === 0}
                            onCheckedChange={(checked) => {
                              if (checked) setExcludedCategories(new Set());
                              else setExcludedCategories(new Set(categoryBreakdown.map((c) => c.category)));
                            }}
                            className="shrink-0"
                          />
                          <span className="text-[10px] text-muted-foreground">Todas las categorías</span>
                        </div>
                        {categoryBreakdown.map((cat) => {
                          const isExcluded = excludedCategories.has(cat.category);
                          return (
                            <div
                              key={cat.category}
                              className={cn(
                                "flex items-center gap-2 py-1.5 group hover:bg-accent/30 -mx-2 px-2 rounded-lg transition-colors cursor-pointer",
                                isExcluded && "opacity-40"
                              )}
                              onClick={() => toggleCategory(cat.category)}
                            >
                              <Checkbox
                                checked={!isExcluded}
                                onCheckedChange={() => toggleCategory(cat.category)}
                                className="shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-sm leading-none shrink-0">{getCatEmoji(cat.category, categories)}</span>
                              <span className="text-xs font-medium truncate flex-1 min-w-0">
                                {cat.category}
                              </span>
                              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                {cat.count} mov
                              </span>
                              <div className="w-12 h-1 rounded-full bg-muted/60 overflow-hidden shrink-0 hidden sm:block">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                                />
                              </div>
                              <span className={cn(
                                "text-xs font-mono font-semibold tabular-nums shrink-0 w-[72px] text-right",
                                isPrivacyMode && "privacy-blur"
                              )}>
                                {formatCompact(cat.effectiveAmount)}
                              </span>
                              {cat.prevAmount > 0 && cat.trendPercentage <= 500 ? (
                                <span className={cn(
                                  "text-[10px] font-semibold tabular-nums shrink-0 w-10 text-right",
                                  cat.trend === "down" ? "text-emerald-500" : cat.trend === "up" ? "text-rose-500" : "text-muted-foreground"
                                )}>
                                  {cat.trend === "up" ? "▲" : cat.trend === "down" ? "▼" : "─"}{cat.trendPercentage.toFixed(0)}%
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/50 shrink-0 w-10 text-right">—</span>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); openCategoryDetail(cat); }}
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </SectionCard>

                    {/* Presupuesto por Categoría */}
                    <SectionCard title="Presupuesto por Categoría">
                      {!hasBudget ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                          <p className="text-sm text-muted-foreground mb-3">
                            Sin presupuesto configurado
                          </p>
                          <Button variant="outline" size="sm" className="rounded-lg text-xs" asChild>
                            <Link to="/budget">🎯 Configurar</Link>
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {categoryBreakdown.map((cat) => {
                            const usage = cat.limitUsage ?? 0;
                            const hasLimit = !!cat.limit;
                            return (
                              <div
                                key={cat.category}
                                className="flex items-center gap-2 py-1.5 group hover:bg-accent/30 -mx-2 px-2 rounded-lg transition-colors"
                              >
                                <span className="text-sm leading-none shrink-0">{getCatEmoji(cat.category, categories)}</span>
                                <span className="text-xs font-medium truncate flex-1 min-w-0">
                                  {cat.category}
                                </span>
                                {hasLimit ? (
                                  <>
                                    <div className="w-20 h-1.5 rounded-full bg-muted/60 overflow-hidden shrink-0">
                                      <div
                                        className={cn(
                                          "h-full rounded-full transition-all",
                                          cat.isOverLimit ? "bg-rose-500" : cat.isNearLimit ? "bg-amber-500" : "bg-emerald-500"
                                        )}
                                        style={{ width: `${Math.min(usage, 100)}%` }}
                                      />
                                    </div>
                                    <span className={cn(
                                      "text-[11px] font-semibold tabular-nums shrink-0 w-10 text-right",
                                      cat.isOverLimit ? "text-rose-500" : cat.isNearLimit ? "text-amber-500" : "text-emerald-500"
                                    )}>
                                      {usage.toFixed(0)}%
                                    </span>
                                    <span className={cn(
                                      "text-[10px] text-muted-foreground tabular-nums shrink-0 w-16 text-right",
                                      isPrivacyMode && "privacy-blur"
                                    )}>
                                      {formatCompact(cat.effectiveAmount)}/{formatCompact(cat.limit!)}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground/40 shrink-0">
                                    sin límite
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </SectionCard>
                  </div>
                )}

              </>
            )}
          </TabsContent>

          {/* ════════════════════════════════════════════ */}
          {/* TAB: HISTÓRICO                               */}
          {/* ════════════════════════════════════════════ */}
          <TabsContent value="historico" className="mt-4 space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
              </div>
            ) : (
              <>
                {/* ── KPI Cards (promedios mensuales) ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Patrimonio", icon: Wallet, value: historicalStats.patrimonio, iconColor: "text-emerald-500", iconBg: "bg-emerald-500/10", gradient: "from-emerald-500/[0.03]" },
                    { label: "Prom. Ingresos", icon: TrendingUp, value: historicalStats.avgIncome, iconColor: "text-emerald-500", iconBg: "bg-emerald-500/10", gradient: "from-emerald-500/[0.03]" },
                    { label: "Prom. Gastos", icon: TrendingDown, value: historicalStats.avgExpenses, iconColor: "text-rose-500", iconBg: "bg-rose-500/10", gradient: "from-rose-500/[0.03]" },
                    { label: "Prom. Balance", icon: CalendarDays, value: historicalStats.avgBalance, iconColor: historicalStats.avgBalance >= 0 ? "text-emerald-500" : "text-rose-500", iconBg: historicalStats.avgBalance >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10", gradient: historicalStats.avgBalance >= 0 ? "from-emerald-500/[0.03]" : "from-rose-500/[0.03]" },
                  ].map((card) => {
                    const Icon = card.icon;
                    return (
                      <GlassCard key={card.label} className={cn("relative overflow-hidden")}>
                        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none", card.gradient)} />
                        <div className="relative px-3 py-3">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={cn("p-1 rounded-md", card.iconBg)}>
                              <Icon className={cn("h-3 w-3", card.iconColor)} />
                            </div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{card.label}</span>
                          </div>
                          <div className={cn("text-lg font-bold font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                            <NumberFlow value={card.value} format={{ style: "currency", currency: "CLP", notation: "compact" }} locales="es-CL" />
                          </div>
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>

                {/* ── Insights Row ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Composition: Disponible / Invertido / Ahorro */}
                  <GlassCard className="p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2.5">
                      Composición
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span className="text-[11px] text-muted-foreground flex-1">Disponible</span>
                        <span className={cn("text-xs font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400", isPrivacyMode && "privacy-blur")}>
                          {formatCompact(historicalStats.totalLiquid)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <PiggyBank className="h-3 w-3 text-sky-500 shrink-0" />
                        <span className="text-[11px] text-muted-foreground flex-1">Invertido</span>
                        <span className={cn("text-xs font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400", isPrivacyMode && "privacy-blur")}>
                          {formatCompact(historicalStats.totalInvested)}
                        </span>
                      </div>
                      {historicalStats.savingsRate > 0 && (
                        <div className="flex items-center gap-2">
                          <Target className="h-3 w-3 text-violet-500 shrink-0" />
                          <span className="text-[11px] text-muted-foreground flex-1">Tasa ahorro</span>
                          <span className={cn("text-xs font-bold font-mono tabular-nums text-violet-600 dark:text-violet-400", isPrivacyMode && "privacy-blur")}>
                            {historicalStats.savingsRate.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </GlassCard>

                  {/* Best & Worst months */}
                  <GlassCard className="p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2.5">
                      Hitos
                    </p>
                    {historicalStats.bestMonth && historicalStats.worstMonth ? (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-muted-foreground leading-none">Mejor mes</p>
                            <p className="text-xs font-semibold capitalize truncate">{historicalStats.bestMonth.name}</p>
                          </div>
                          <span className={cn("text-[11px] font-bold font-mono tabular-nums text-emerald-600 shrink-0", isPrivacyMode && "privacy-blur")}>
                            +{formatCompact(historicalStats.bestMonth.balance)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-muted-foreground leading-none">Peor mes</p>
                            <p className="text-xs font-semibold capitalize truncate">{historicalStats.worstMonth.name}</p>
                          </div>
                          <span className={cn("text-[11px] font-bold font-mono tabular-nums text-rose-600 shrink-0", isPrivacyMode && "privacy-blur")}>
                            {formatCompact(historicalStats.worstMonth.balance)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Necesitas al menos 2 meses</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/40 font-mono tabular-nums mt-2">
                      {historicalStats.monthsWithData} {historicalStats.monthsWithData === 1 ? "mes" : "meses"} de datos
                    </p>
                  </GlassCard>

                  {/* Credit Cards Mini */}
                  <GlassCard className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                        Tarjetas
                      </p>
                      <Link to="/credit-cards" className="text-[10px] text-primary hover:underline">
                        Ver →
                      </Link>
                    </div>
                    {cardSummaries.length > 0 ? (
                      <>
                        {cardTotals.totalLimit > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                              <span>Cupo usado</span>
                              <span className={cn("font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                                {Math.round((cardTotals.totalUsed / cardTotals.totalLimit) * 100)}%
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary/70"
                                style={{ width: `${Math.min((cardTotals.totalUsed / cardTotals.totalLimit) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          {cardSummaries.slice(0, 3).map((card) => (
                            <div key={card.id} className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: card.color || "#6b7280" }} />
                              <span className="text-[11px] truncate flex-1">{card.name}</span>
                              <span className={cn("text-[11px] font-mono font-semibold tabular-nums shrink-0", isPrivacyMode && "privacy-blur")}>
                                {formatCompact(card.total_used_credit)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sin tarjetas</p>
                    )}
                  </GlassCard>
                </div>

                {/* Monthly Evolution */}
                <SectionCard
                  title="Evolución Mensual"
                  tooltip="Tendencia de ingresos, gastos e inversiones a lo largo de todo tu historial"
                >
                  <MonthlyEvolutionChart data={monthlyData} />
                </SectionCard>

                {/* Projection + Expenses side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Expenses by Category — historical accumulation */}
                  {expensesByCategory.length > 0 && (
                    <SectionCard title="Gasto Acumulado por Categoría" tooltip="Top categorías con mayor gasto en todo tu historial">
                      <div className="space-y-0.5">
                        {expensesByCategory.map((cat) => {
                          const maxVal = expensesByCategory[0]?.value || 1;
                          return (
                            <div
                              key={cat.name}
                              className="flex items-center gap-2 py-1.5 group hover:bg-accent/30 -mx-2 px-2 rounded-lg transition-colors"
                            >
                              <span className="text-sm leading-none shrink-0">{getCatEmoji(cat.name, categories)}</span>
                              <span className="text-xs font-medium truncate flex-1 min-w-0">
                                {cat.name}
                              </span>
                              <div className="w-16 h-1 rounded-full bg-muted/60 overflow-hidden shrink-0">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${(cat.value / maxVal) * 100}%`, backgroundColor: cat.color }}
                                />
                              </div>
                              <span className={cn(
                                "text-xs font-mono font-semibold tabular-nums shrink-0 w-[72px] text-right",
                                isPrivacyMode && "privacy-blur"
                              )}>
                                {formatCompact(cat.value)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </SectionCard>
                  )}

                  {/* Projection */}
                  <SectionCard title="Proyección Financiera" tooltip="Proyección de patrimonio basada en tu historial">
                    <ProjectionCard />
                  </SectionCard>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Monthly Story */}
      <MonthlyStory
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        month={selectedMonth}
        kpis={kpis}
        categoryBreakdown={categoryBreakdown}
        dailyStats={dailyStats}
        transactionCount={transactionCount}
        salary={storySalary}
        insights={storyInsights}
      />

      <CategoryDetailModal
        open={!!selectedCategory}
        onOpenChange={(open) => { if (!open) setSelectedCategory(null); }}
        category={selectedCategory}
        monthName={format(selectedMonth, "MMMM yyyy", { locale: es })}
      />
    </Layout>
  );
}
