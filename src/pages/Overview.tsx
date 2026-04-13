import { useState, useMemo, useEffect } from "react";
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
  type DailySpending,
} from "@/hooks/useMonthlySummary";
import { CHART_COLORS } from "@/lib/chart-config";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import {
  format,
  subMonths,
  addMonths,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Wallet,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Info,
  Target,
  CreditCard,
  ArrowRight,
  Play,
} from "lucide-react";
import { MonthlyStory } from "@/components/MonthlyStory";
import { MonthlyEvolutionChart } from "@/components/MonthlyEvolutionChart";
import ProjectionCard from "@/components/ProjectionCard";
import { CreditCardWidget } from "@/components/CreditCardWidget";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { getCategoryIcon } from "@/components/TransactionsTable";
import { Checkbox } from "@/components/ui/checkbox";

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

function DailyTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as DailySpending;
  return (
    <div className="bg-card border border-border/50 rounded-xl p-3 shadow-lg">
      <p className="font-semibold text-sm text-foreground capitalize">
        {data.dayName} {data.date}
      </p>
      <p className="text-sm font-mono tabular-nums font-semibold text-rose-500">
        {formatCurrency(data.amount)}
      </p>
      {data.isWeekend && (
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Fin de semana
        </p>
      )}
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
  const { transactions, isLoading } = useTransactions();
  const { categories } = useCategories();
  const { limits } = useCategoryLimits();
  const { budget } = useMonthlyBudget();
  const { creditCards } = useCreditCards();
  const { isPrivacyMode } = usePrivacyMode();

  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(new Set());

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

  // Month navigation
  const changeMonth = (delta: number) => {
    setSelectedMonth((prev) =>
      delta > 0 ? addMonths(prev, 1) : subMonths(prev, 1)
    );
  };

  const isCurrentMonth =
    format(selectedMonth, "yyyy-MM") === format(new Date(), "yyyy-MM");

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

  const last6Months = useMemo(
    () =>
      eachMonthOfInterval({
        start: subMonths(new Date(), 5),
        end: new Date(),
      }),
    []
  );

  const monthlyData = useMemo(() => {
    return last6Months.map((month) => {
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
        month: format(month, "MMM", { locale: es }),
        Ingresos: income,
        Gastos: expenses,
        Inversiones: investments,
        Balance: income - expenses - investments,
      };
    });
  }, [last6Months, transactions]);

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
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight mb-1">
                Finanzas
              </h1>
              <p className="text-sm text-muted-foreground">
                {isLoading
                  ? "Cargando..."
                  : `${transactionCount} movimientos en ${format(selectedMonth, "MMMM", { locale: es })}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                onClick={() => setStoryOpen(true)}
                disabled={transactionCount === 0}
              >
                <Play className="h-3.5 w-3.5 ml-0.5" />
              </Button>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => changeMonth(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <button
                  onClick={() => !isCurrentMonth && setSelectedMonth(new Date())}
                  className={cn(
                    "min-w-[180px] text-center px-3 py-1.5 rounded-lg transition-colors",
                    !isCurrentMonth
                      ? "hover:bg-accent cursor-pointer"
                      : "cursor-default"
                  )}
                >
                  <span className="text-lg font-semibold capitalize">
                    {format(selectedMonth, "MMMM yyyy", { locale: es })}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => changeMonth(1)}
                  disabled={isCurrentMonth}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {!isCurrentMonth && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2 text-xs h-7 rounded-lg"
                    onClick={() => setSelectedMonth(new Date())}
                  >
                    Hoy
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Tabs ──────────────────────────────────── */}
        <Tabs defaultValue="mes" className="w-full">
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

                {/* Savings Rate Banner */}
                {(kpis.income > 0 || kpis.projectedSavingsRate !== null) && (() => {
                  const isProjected = kpis.projectedSavingsRate !== null && kpis.income === 0;
                  const displayRate = isProjected ? kpis.projectedSavingsRate! : kpis.savingsRate;
                  return (
                    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-r from-violet-500/[0.03] via-card to-card px-4 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-md bg-violet-500/10">
                            <Target className="h-3.5 w-3.5 text-violet-500" />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                              {isProjected ? "Tasa de Ahorro (proyectada)" : "Tasa de Ahorro"}
                            </p>
                            <div
                              className={cn(
                                "text-lg font-bold font-mono tabular-nums",
                                displayRate >= 0
                                  ? "text-violet-500"
                                  : "text-rose-500",
                                isPrivacyMode && "privacy-blur"
                              )}
                            >
                              {isProjected && <span className="text-xs font-normal text-muted-foreground mr-0.5">~</span>}
                              <NumberFlow
                                value={displayRate}
                                format={{ maximumFractionDigits: 1 }}
                              />
                              %
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {isProjected && kpis.expectedSalary ? (
                            <>
                              <p className="text-[10px] text-muted-foreground">
                                Sueldo esperado
                              </p>
                              <p
                                className={cn(
                                  "text-xs font-mono tabular-nums text-muted-foreground",
                                  isPrivacyMode && "privacy-blur"
                                )}
                              >
                                {formatCompact(kpis.expectedSalary)}
                              </p>
                            </>
                          ) : kpis.prevSavingsRate !== 0 ? (
                            <>
                              <p className="text-[10px] text-muted-foreground">
                                Mes anterior
                              </p>
                              <p
                                className={cn(
                                  "text-xs font-mono tabular-nums text-muted-foreground",
                                  isPrivacyMode && "privacy-blur"
                                )}
                              >
                                {kpis.prevSavingsRate.toFixed(1)}%
                              </p>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })()}

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

                {/* Gasto Diario */}
                {dailySpending.length > 0 && (
                  <SectionCard
                    title="Gasto Diario"
                    tooltip="Gasto por día del mes. La línea punteada es el promedio diario"
                  >
                    <div>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart
                          data={dailySpending}
                          className={cn(isPrivacyMode && "privacy-blur")}
                        >
                          <XAxis
                            dataKey="day"
                            fontSize={9}
                            tickLine={false}
                            axisLine={false}
                            stroke={CHART_COLORS.mutedAxis}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            fontSize={9}
                            tickLine={false}
                            axisLine={false}
                            stroke={CHART_COLORS.mutedAxis}
                            tickFormatter={formatCompact}
                            width={45}
                          />
                          <ChartTooltip content={<DailyTooltip />} />
                          <ReferenceLine
                            y={dailyStats.avgDaily}
                            stroke={CHART_COLORS.balance}
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                          />
                          <Bar dataKey="amount" radius={[3, 3, 0, 0]} maxBarSize={14}>
                            {dailySpending.map((entry, i) => (
                              <Cell
                                key={i}
                                fill={CHART_COLORS.expense}
                                opacity={
                                  entry.amount === 0 ? 0.08 : entry.isWeekend ? 0.55 : 1
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                        <span>
                          📊 Prom:{" "}
                          <span className={cn("font-semibold text-foreground font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                            {formatCompact(dailyStats.avgDaily)}/día
                          </span>
                        </span>
                        {dailyStats.peakDay && (
                          <span>
                            🔺 Pico:{" "}
                            <span className={cn("font-semibold text-foreground font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                              {formatCompact(dailyStats.peakDay.amount)}
                            </span>
                          </span>
                        )}
                        <span>
                          📅 {dailyStats.daysWithSpending}/{dailyStats.totalDays} días
                        </span>
                      </div>
                    </div>
                  </SectionCard>
                )}

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

                {/* Tarjetas (compact) */}
                {monthlyCardSpending.length > 0 && (
                  <SectionCard title="Tarjetas" icon={CreditCard}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {monthlyCardSpending.map((card) => {
                        const usage = card.credit_limit > 0 ? (card.spent / card.credit_limit) * 100 : 0;
                        return (
                          <div key={card.id} className="flex items-center gap-2.5 py-1">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: card.color || "#6b7280" }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium truncate">{card.name}</span>
                                <span className={cn("text-xs font-mono font-semibold tabular-nums shrink-0", isPrivacyMode && "privacy-blur")}>
                                  {formatCompact(card.spent)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <div className="flex-1 h-1 rounded-full bg-muted/60 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${Math.min(usage, 100)}%`, backgroundColor: card.color || "#6b7280" }}
                                  />
                                </div>
                                <span className={cn("text-[9px] text-muted-foreground tabular-nums shrink-0", isPrivacyMode && "privacy-blur")}>
                                  {usage.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>
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
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
              </div>
            ) : (
              <>
                {/* Compact KPIs */}
                <GlassCard className="px-4 py-2.5">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {kpiCards.map((card) => {
                      const Icon = card.icon;
                      return (
                        <div key={card.label} className="flex items-center gap-2">
                          <div className={cn("p-1 rounded-md", card.iconBg)}>
                            <Icon className={cn("h-3 w-3", card.iconColor)} />
                          </div>
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                              {card.label}
                            </p>
                            <p
                              className={cn(
                                "text-xs font-bold font-mono tabular-nums",
                                isPrivacyMode && "privacy-blur"
                              )}
                            >
                              {formatCompact(card.value)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>

                {/* Monthly Evolution */}
                <SectionCard
                  title="Evolución Mensual"
                  tooltip="Tendencia de ingresos, gastos e inversiones en los últimos 6 meses"
                >
                  <MonthlyEvolutionChart data={monthlyData} />
                </SectionCard>

                {/* Projection */}
                <SectionCard title="Proyección Financiera" tooltip="Proyección de patrimonio basada en tu historial">
                  <ProjectionCard />
                </SectionCard>

                {/* Gastos + Tarjetas side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Expenses by Category - Compact list with emojis */}
                  {expensesByCategory.length > 0 && (
                    <SectionCard title="Gastos por Categoría" tooltip="Top categorías con mayor gasto acumulado">
                      <div className="space-y-0.5">
                        {expensesByCategory.map((cat, i) => {
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

                  {/* Credit Cards Detail */}
                  <SectionCard title="Tarjetas de Crédito" icon={CreditCard}>
                    <CreditCardWidget />
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
      />
    </Layout>
  );
}
