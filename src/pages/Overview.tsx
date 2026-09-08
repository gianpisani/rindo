import { useState, useMemo, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import { Screen, Row, Panel } from "@/components/HairlineGrid";
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
    <div className="bg-card border border-border rounded-xl p-3 shadow-lg">
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

/**
 * Una sección de análisis: ya no es una tarjeta flotando, es una celda de
 * la grilla. El rótulo va en su propia franja, separado del cuerpo por la
 * línea. Con `flush` el cuerpo pierde el padding, para que una lista de
 * filas llegue a los cantos del panel.
 */
function SectionCard({
  title,
  icon: Icon,
  tooltip,
  children,
  className,
  flush = false,
}: {
  title: string;
  icon?: LucideIcon;
  tooltip?: string;
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <Panel className={cn("flex flex-col", className)}>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
        {Icon && <Icon className="h-3 w-3 shrink-0 text-primary" />}
        <h3 className="eyebrow">{title}</h3>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 cursor-help text-muted-foreground/60 transition-colors hover:text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div
        className={cn(
          "flex-1 overflow-y-auto lg:min-h-0",
          !flush && "p-4"
        )}
      >
        {children}
      </div>
    </Panel>
  );
}

// ─── KPI Card ────────────────────────────────────────────

interface KPICardProps {
  label: string;
  icon: LucideIcon;
  value: number;
  prev: number;
  iconColor: string;
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

  /* Celda plana: el rótulo arriba, el número grande, y el delta como
     texto con color — no como pastilla teñida flotando. */
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Panel className="px-4 py-3.5 md:px-5">
          <div className="flex items-center gap-1.5">
            <Icon className={cn("h-3 w-3 shrink-0", iconColor)} />
            <span className="eyebrow truncate">{label}</span>
          </div>
          <div
            className={cn(
              "mt-2 font-mono text-lg font-bold tracking-tight tabular-nums md:text-xl",
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
          {showDelta ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              <span
                className={cn(
                  "font-mono font-semibold tabular-nums",
                  isGood ? "text-success" : "text-destructive"
                )}
              >
                {isPositive ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
              </span>{" "}
              vs {prevMonthLabel}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Sin comparación
            </p>
          )}
        </Panel>
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
      iconColor: "text-success",
      invertDelta: false,
    },
    {
      label: "Gastos",
      icon: TrendingDown,
      value: kpis.expenses,
      prev: kpis.prevExpenses,
      iconColor: "text-destructive",
      invertDelta: true,
    },
    {
      label: "Inversiones",
      icon: PiggyBank,
      value: kpis.investments,
      prev: kpis.prevInvestments,
      iconColor: "text-info",
      invertDelta: false,
    },
    {
      label: "Balance",
      icon: Wallet,
      value: kpis.balance,
      prev: kpis.prevBalance,
      iconColor:
        kpis.balance >= 0 ? "text-success" : "text-destructive",
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
        color: CHART_COLORS.mutedAxis,
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
    let cumulativePatrimonio = 0;
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
      cumulativePatrimonio += income - expenses;
      return {
        month: format(month, "MMM yy", { locale: es }),
        Ingresos: income,
        Gastos: expenses,
        Inversiones: investments,
        Balance: income - expenses - investments,
        Patrimonio: cumulativePatrimonio,
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
            color: category?.color || CHART_COLORS.expense,
          });
        }
        return acc;
      }, [] as { name: string; value: number; color: string }[])
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [transactions, categories]);

  const hasBudget = (budgetSummary?.totalBudget ?? 0) > 0;

  /* La celda de una pestaña: bloque de acento cuando está activa. */
  const TAB_CELL =
    "section-title min-w-0 truncate rounded-sm bg-card px-4 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground";

  return (
    <Layout bleed>
      {/* Mismo chasis que Inicio, pero esta es la página de análisis: las
          franjas de arriba son datos, no atajos. El Tabs hace de
          contenedor de filas — identidad arriba y el cuerpo de la
          pestaña repartiéndose lo que sobra del viewport. Las dos listas
          largas viven abajo del pliegue, que es donde se leen. */}
      <Screen>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex min-h-0 flex-1 flex-col gap-px bg-border"
        >
          {/* ── Fila 1 — identidad y de qué mirada hablamos ─────── */}
          <Panel className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-5 lg:shrink-0">
            <div className="min-w-0">
              <h1 className="page-title text-xl md:text-2xl">Finanzas</h1>
              <p className="eyebrow mt-1">
                {activeTab === "mes"
                  ? isLoading
                    ? "Cargando"
                    : `${transactionCount} ${transactionCount === 1 ? "movimiento" : "movimientos"} en ${format(selectedMonth, "MMMM", { locale: es })}`
                  : `${historicalStats.monthsWithData} ${historicalStats.monthsWithData === 1 ? "mes" : "meses"} de historial`}
              </p>
            </div>
            <TabsList className="ml-auto grid h-auto shrink-0 grid-cols-2 gap-px border border-border bg-border p-0">
              <TabsTrigger value="mes" className={TAB_CELL}>
                Mes
              </TabsTrigger>
              <TabsTrigger value="historico" className={TAB_CELL}>
                Histórico
              </TabsTrigger>
            </TabsList>
          </Panel>

          {/* ════════════════════════════════════════════ */}
          {/* PESTAÑA: MES                                 */}
          {/* ════════════════════════════════════════════ */}
          <TabsContent
            value="mes"
            className="mt-0 flex flex-col gap-px bg-border lg:min-h-0 lg:flex-1"
          >
            {/* ── Los meses. Franja de chrome: celdas cuadradas y la
                activa es el bloque de acento. ──────────────────── */}
            <Panel className="flex items-center gap-2 px-4 py-2 md:px-5 lg:shrink-0">
              <div
                ref={monthStripRef}
                className="flex flex-1 items-center gap-px overflow-x-auto scrollbar-hide"
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
                        "relative flex shrink-0 flex-col items-center px-2.5 py-1 text-center transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {showYear && (
                        <span
                          className={cn(
                            "font-mono text-[9px] uppercase leading-none tracking-widest",
                            isActive ? "opacity-70" : "opacity-50"
                          )}
                        >
                          {format(month, "yyyy")}
                        </span>
                      )}
                      <span className="text-[13px] font-semibold capitalize leading-tight">
                        {format(month, "MMM", { locale: es })}
                      </span>
                      {isCurrent && !isActive && (
                        <span className="absolute inset-x-1 bottom-0 h-[2px] bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* El resumen del mes en video */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setStoryOpen(true)}
                    disabled={transactionCount === 0}
                  >
                    <Play className="ml-0.5 h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Resumen del mes</p>
                </TooltipContent>
              </Tooltip>
            </Panel>

            {isLoading ? (
              <>
                <Row className="grid-cols-2 lg:shrink-0 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Panel key={i} className="p-4">
                      <Skeleton className="h-16 w-full" />
                    </Panel>
                  ))}
                </Row>
                <Panel className="p-4 lg:min-h-0 lg:flex-1">
                  <Skeleton className="h-40 w-full lg:h-full" />
                </Panel>
              </>
            ) : transactionCount === 0 ? (
              <Panel className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center lg:min-h-0 lg:flex-1">
                <div className="flex size-14 items-center justify-center border border-border">
                  <CalendarDays className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="section-title text-sm">Sin movimientos</p>
                <p className="text-xs text-muted-foreground">
                  No hay transacciones en{" "}
                  {format(selectedMonth, "MMMM yyyy", { locale: es })}
                </p>
              </Panel>
            ) : (
              <>
                {/* ── Los cuatro indicadores del mes ───────────── */}
                <Row className="grid-cols-2 lg:shrink-0 lg:grid-cols-4">
                  {kpiCards.map((card) => (
                    <KPICard
                      key={card.label}
                      {...card}
                      prevMonthLabel={prevMonthLabel}
                      isPrivacyMode={isPrivacyMode}
                    />
                  ))}
                </Row>

                {/* ── Los tres datos de contexto ───────────────── */}
                <Row className="grid-cols-1 sm:grid-cols-3 lg:shrink-0">
                  {/* Tasa de ahorro. El anillo es un anillo: sigue
                      redondo, como cualquier medidor circular. */}
                  {(() => {
                    const showSavings = kpis.income > 0 || kpis.projectedSavingsRate !== null;
                    if (!showSavings) return <Panel>{null}</Panel>;
                    const isProjected = kpis.projectedSavingsRate !== null && kpis.income === 0;
                    const displayRate = isProjected ? kpis.projectedSavingsRate! : kpis.savingsRate;
                    const absRate = Math.min(Math.abs(displayRate), 100);
                    const circumference = 2 * Math.PI * 28;
                    const strokeDash = (absRate / 100) * circumference;
                    return (
                      <Panel className="px-4 py-3 md:px-5">
                        <div className="flex items-center gap-3">
                          <div className="relative h-[60px] w-[60px] shrink-0">
                            <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
                              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
                              <circle
                                cx="32" cy="32" r="28" fill="none" strokeWidth="5"
                                style={{
                                  stroke:
                                    displayRate >= 0
                                      ? "oklch(var(--insight-pattern))"
                                      : "oklch(var(--destructive))",
                                }}
                                strokeDasharray={`${strokeDash} ${circumference}`}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span
                                className={cn(
                                  "font-mono text-xs font-bold tabular-nums",
                                  displayRate < 0 && "text-destructive",
                                  isPrivacyMode && "privacy-blur"
                                )}
                                style={
                                  displayRate >= 0
                                    ? { color: "oklch(var(--insight-pattern))" }
                                    : undefined
                                }
                              >
                                {displayRate.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="eyebrow">
                              {isProjected ? "Ahorro (proy.)" : "Tasa de ahorro"}
                            </p>
                            <div
                              className={cn(
                                "mt-1 font-mono text-lg font-bold tracking-tight tabular-nums",
                                displayRate < 0 && "text-destructive",
                                isPrivacyMode && "privacy-blur"
                              )}
                              style={
                                displayRate >= 0
                                  ? { color: "oklch(var(--insight-pattern))" }
                                  : undefined
                              }
                            >
                              <NumberFlow value={displayRate} format={{ maximumFractionDigits: 1 }} />%
                            </div>
                            {kpis.prevSavingsRate !== 0 && (
                              <p className={cn("mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground", isPrivacyMode && "privacy-blur")}>
                                Ant: {kpis.prevSavingsRate.toFixed(1)}%
                              </p>
                            )}
                          </div>
                        </div>
                      </Panel>
                    );
                  })()}

                  {/* Gasto diario */}
                  {dailySpending.length > 0 ? (
                    <Panel className="px-4 py-3 md:px-5">
                      <p className="eyebrow">Gasto diario</p>
                      <div className={cn("mt-1.5 font-mono text-lg font-bold tracking-tight tabular-nums", isPrivacyMode && "privacy-blur")}>
                        {formatCompact(dailyStats.avgDaily)}
                        <span className="text-xs font-normal text-muted-foreground">/día</span>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                        {dailyStats.peakDay && (
                          <span className="flex items-center gap-1">
                            <Flame className="h-3 w-3 text-warning" />
                            <span className={cn("font-mono font-semibold tabular-nums text-foreground", isPrivacyMode && "privacy-blur")}>
                              {formatCompact(dailyStats.peakDay.amount)}
                            </span>
                          </span>
                        )}
                        <span className="font-mono tabular-nums">
                          {dailyStats.daysWithSpending}/{dailyStats.totalDays} días
                        </span>
                      </div>
                    </Panel>
                  ) : <Panel>{null}</Panel>}

                  {/* Tarjetas */}
                  {monthlyCardSpending.length > 0 ? (
                    <Panel className="px-4 py-3 md:px-5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="eyebrow">Tarjetas</p>
                        <Link to="/credit-cards" className="eyebrow text-primary hover:underline">
                          Ver →
                        </Link>
                      </div>
                      {cardTotals.totalLimit > 0 && (
                        <div className="mt-1.5">
                          <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>Cupo usado</span>
                            <span className={cn("font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                              {Math.round((cardTotals.totalUsed / cardTotals.totalLimit) * 100)}%
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
                            <div
                              className="h-full rounded-sm bg-primary"
                              style={{ width: `${Math.min((cardTotals.totalUsed / cardTotals.totalLimit) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="mt-2 space-y-1.5">
                        {monthlyCardSpending.slice(0, 3).map((card) => (
                          <div key={card.id} className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: card.color || "var(--muted-foreground)" }} />
                            <span className="flex-1 truncate text-[11px]">{card.name}</span>
                            <span className={cn("shrink-0 font-mono text-[11px] font-semibold tabular-nums", isPrivacyMode && "privacy-blur")}>
                              {formatCompact(card.spent)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  ) : <Panel>{null}</Panel>}
                </Row>

                {/* ── La fila que cede: la torta y la comparación.
                    Las dos scrollean por dentro. ─────────────── */}
                <Row className="lg:min-h-0 lg:flex-1 lg:grid-cols-[7fr_5fr]">
                  <SectionCard
                    title="Gastos por categoría"
                    tooltip="Distribución de gastos del mes por categoría"
                  >
                    {categoryBreakdown.length === 0 ? (
                      <p className="py-6 text-center text-xs text-muted-foreground">
                        Sin gastos registrados
                      </p>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="relative w-full max-w-[220px]">
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={donutData}
                                dataKey="amount"
                                nameKey="category"
                                cx="50%"
                                cy="50%"
                                innerRadius={56}
                                outerRadius={84}
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
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <p className="eyebrow">Total</p>
                              <p
                                className={cn(
                                  "mt-0.5 font-mono text-base font-bold tabular-nums",
                                  isPrivacyMode && "privacy-blur"
                                )}
                              >
                                {formatCompact(filteredTotal)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
                          {donutData.map((cat) => (
                            <div key={cat.category} className="flex items-center gap-1">
                              <span className="text-[11px] leading-none">{getCatEmoji(cat.category, categories)}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {cat.category}
                              </span>
                              <span className="font-mono text-[10px] font-semibold tabular-nums">
                                {cat.percentage.toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </SectionCard>

                  <SectionCard
                    title="vs mes anterior"
                    icon={ArrowRight}
                    tooltip={`Comparación con ${prevMonthLabel}`}
                  >
                    <div className="space-y-3">
                      {comparisonData.map((item) => {
                        const maxVal = Math.max(item.current, item.previous) || 1;
                        return (
                          <div key={item.label} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">{item.label}</span>
                              <span
                                className={cn(
                                  "font-mono text-xs font-semibold tabular-nums",
                                  isPrivacyMode && "privacy-blur"
                                )}
                              >
                                {formatCompact(item.current)}
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-sm bg-muted">
                              <div
                                className="h-full rounded-sm transition-[width] duration-700 ease-out"
                                style={{
                                  width: `${(item.current / maxVal) * 100}%`,
                                  backgroundColor: item.color,
                                }}
                              />
                            </div>
                            <div className="h-1 overflow-hidden rounded-sm bg-muted">
                              <div
                                className="h-full rounded-sm opacity-35 transition-[width] duration-700 ease-out"
                                style={{
                                  width: `${(item.previous / maxVal) * 100}%`,
                                  backgroundColor: item.color,
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <span
                                className={cn(
                                  "font-mono text-[9px] tabular-nums text-muted-foreground",
                                  isPrivacyMode && "privacy-blur"
                                )}
                              >
                                {format(subMonths(selectedMonth, 1), "MMM", { locale: es })}
                                : {formatCompact(item.previous)}
                              </span>
                              {item.delta !== 0 && (
                                <span
                                  className={cn(
                                    "font-mono text-[10px] font-semibold tabular-nums",
                                    item.isGood ? "text-success" : "text-destructive"
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
                      {/* El cierre de la comparación: tira de pelo con su
                          tono, no una caja teñida. */}
                      {summaryInsight && (
                        <div className="flex items-start gap-2.5 border-t border-border pt-2.5">
                          <div
                            className={cn(
                              "mt-0.5 h-[22px] w-[3px] shrink-0",
                              summaryInsight.isGood ? "bg-success" : "bg-destructive"
                            )}
                          />
                          <p className="min-w-0 text-[11px] font-medium leading-snug">
                            {summaryInsight.text}
                          </p>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                </Row>
              </>
            )}
          </TabsContent>

          {/* ════════════════════════════════════════════ */}
          {/* PESTAÑA: HISTÓRICO                           */}
          {/* ════════════════════════════════════════════ */}
          <TabsContent
            value="historico"
            className="mt-0 flex flex-col gap-px bg-border lg:min-h-0 lg:flex-1"
          >
            {isLoading ? (
              <>
                <Row className="grid-cols-2 lg:shrink-0 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Panel key={i} className="p-4">
                      <Skeleton className="h-16 w-full" />
                    </Panel>
                  ))}
                </Row>
                <Panel className="p-4 lg:min-h-0 lg:flex-1">
                  <Skeleton className="h-40 w-full lg:h-full" />
                </Panel>
              </>
            ) : (
              <>
                {/* ── Los promedios del historial ──────────────── */}
                <Row className="grid-cols-2 lg:shrink-0 lg:grid-cols-4">
                  {[
                    { label: "Patrimonio", icon: Wallet, value: historicalStats.patrimonio, iconColor: "text-success" },
                    { label: "Prom. ingresos", icon: TrendingUp, value: historicalStats.avgIncome, iconColor: "text-success" },
                    { label: "Prom. gastos", icon: TrendingDown, value: historicalStats.avgExpenses, iconColor: "text-destructive" },
                    { label: "Prom. balance", icon: CalendarDays, value: historicalStats.avgBalance, iconColor: historicalStats.avgBalance >= 0 ? "text-success" : "text-destructive" },
                  ].map((card) => {
                    const Icon = card.icon;
                    return (
                      <Panel key={card.label} className="px-4 py-3.5 md:px-5">
                        <div className="flex items-center gap-1.5">
                          <Icon className={cn("h-3 w-3 shrink-0", card.iconColor)} />
                          <span className="eyebrow truncate">{card.label}</span>
                        </div>
                        <div className={cn("mt-2 font-mono text-lg font-bold tracking-tight tabular-nums md:text-xl", isPrivacyMode && "privacy-blur")}>
                          <NumberFlow value={card.value} format={{ style: "currency", currency: "CLP", minimumFractionDigits: 0, maximumFractionDigits: 0 }} locales="es-CL" />
                        </div>
                      </Panel>
                    );
                  })}
                </Row>

                {/* ── Los tres datos de contexto ───────────────── */}
                <Row className="grid-cols-1 sm:grid-cols-3 lg:shrink-0">
                  {/* Composición del patrimonio */}
                  <Panel className="px-4 py-3 md:px-5">
                    <p className="eyebrow">Composición</p>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-3 w-3 shrink-0 text-success" />
                        <span className="flex-1 text-[11px] text-muted-foreground">Disponible</span>
                        <span className={cn("font-mono text-xs font-bold tabular-nums text-success ", isPrivacyMode && "privacy-blur")}>
                          {formatCurrency(historicalStats.totalLiquid)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <PiggyBank className="h-3 w-3 shrink-0 text-info" />
                        <span className="flex-1 text-[11px] text-muted-foreground">Invertido</span>
                        <span className={cn("font-mono text-xs font-bold tabular-nums text-info", isPrivacyMode && "privacy-blur")}>
                          {formatCurrency(historicalStats.totalInvested)}
                        </span>
                      </div>
                      {historicalStats.savingsRate > 0 && (
                        <div className="flex items-center gap-2">
                          <Target
                          className="h-3 w-3 shrink-0"
                          style={{ color: "oklch(var(--insight-pattern))" }}
                        />
                          <span className="flex-1 text-[11px] text-muted-foreground">Tasa ahorro</span>
                          <span className={cn("font-mono text-xs font-bold tabular-nums", isPrivacyMode && "privacy-blur")}
                            style={{ color: "oklch(var(--insight-pattern))" }}>
                            {historicalStats.savingsRate.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </Panel>

                  {/* El mejor y el peor mes */}
                  <Panel className="px-4 py-3 md:px-5">
                    <p className="eyebrow">Hitos</p>
                    {historicalStats.bestMonth && historicalStats.worstMonth ? (
                      <div className="mt-2 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-3.5 w-3.5 shrink-0 text-success" />
                          <div className="min-w-0 flex-1">
                            <p className="eyebrow">Mejor mes</p>
                            <p className="truncate text-xs font-semibold capitalize">{historicalStats.bestMonth.name}</p>
                          </div>
                          <span className={cn("shrink-0 font-mono text-[11px] font-bold tabular-nums text-success", isPrivacyMode && "privacy-blur")}>
                            +{formatCurrency(historicalStats.bestMonth.balance)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-destructive" />
                          <div className="min-w-0 flex-1">
                            <p className="eyebrow">Peor mes</p>
                            <p className="truncate text-xs font-semibold capitalize">{historicalStats.worstMonth.name}</p>
                          </div>
                          <span className={cn("shrink-0 font-mono text-[11px] font-bold tabular-nums text-destructive", isPrivacyMode && "privacy-blur")}>
                            {formatCurrency(historicalStats.worstMonth.balance)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">Necesitas al menos 2 meses</p>
                    )}
                  </Panel>

                  {/* Tarjetas */}
                  <Panel className="px-4 py-3 md:px-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="eyebrow">Tarjetas</p>
                      <Link to="/credit-cards" className="eyebrow text-primary hover:underline">
                        Ver →
                      </Link>
                    </div>
                    {cardSummaries.length > 0 ? (
                      <>
                        {cardTotals.totalLimit > 0 && (
                          <div className="mt-1.5">
                            <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>Cupo usado</span>
                              <span className={cn("font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                                {Math.round((cardTotals.totalUsed / cardTotals.totalLimit) * 100)}%
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
                              <div
                                className="h-full rounded-sm bg-primary"
                                style={{ width: `${Math.min((cardTotals.totalUsed / cardTotals.totalLimit) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <div className="mt-2 space-y-1.5">
                          {cardSummaries.slice(0, 3).map((card) => (
                            <div key={card.id} className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: card.color || "var(--muted-foreground)" }} />
                              <span className="flex-1 truncate text-[11px]">{card.name}</span>
                              <span className={cn("shrink-0 font-mono text-[11px] font-semibold tabular-nums", isPrivacyMode && "privacy-blur")}>
                                {formatCompact(card.total_used_credit)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">Sin tarjetas</p>
                    )}
                  </Panel>
                </Row>

                {/* ── La fila que cede: la evolución del historial ─ */}
                <SectionCard
                  title="Evolución mensual"
                  tooltip="Tendencia de ingresos, gastos e inversiones a lo largo de todo tu historial"
                  className="lg:min-h-0 lg:flex-1"
                >
                  <MonthlyEvolutionChart data={monthlyData} />
                </SectionCard>
              </>
            )}
          </TabsContent>
        </Tabs>
      </Screen>

      {/* ── ABAJO DEL PLIEGUE ─────────────────────────────────────
          Las listas largas: son para leer con detención, no para
          espiar de reojo en la primera pantalla. ───────────────── */}
      {activeTab === "mes" && !isLoading && transactionCount > 0 && categoryBreakdown.length > 0 && (
        <Row className="border-b border-border lg:grid-cols-2">
          <SectionCard title="Gastos por categoría" flush>
            {/* Cabecera de la lista: elegir todas */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-1.5">
              <Checkbox
                checked={excludedCategories.size === 0}
                onCheckedChange={(checked) => {
                  if (checked) setExcludedCategories(new Set());
                  else setExcludedCategories(new Set(categoryBreakdown.map((c) => c.category)));
                }}
                className="shrink-0"
              />
              <span className="eyebrow">Todas las categorías</span>
            </div>
            {categoryBreakdown.map((cat) => {
              const isExcluded = excludedCategories.has(cat.category);
              return (
                <div
                  key={cat.category}
                  className={cn(
                    "group flex cursor-pointer items-center gap-2 border-b border-border px-4 py-1.5 transition-colors last:border-b-0 hover:bg-muted",
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
                  <span className="shrink-0 text-sm leading-none">{getCatEmoji(cat.category, categories)}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {cat.category}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {cat.count} mov
                  </span>
                  <div className="hidden h-1 w-12 shrink-0 overflow-hidden rounded-sm bg-muted sm:block">
                    <div
                      className="h-full rounded-sm"
                      style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                    />
                  </div>
                  <span className={cn(
                    "w-[72px] shrink-0 text-right font-mono text-xs font-semibold tabular-nums",
                    isPrivacyMode && "privacy-blur"
                  )}>
                    {formatCompact(cat.effectiveAmount)}
                  </span>
                  {cat.prevAmount > 0 && cat.trendPercentage <= 500 ? (
                    <span className={cn(
                      "w-10 shrink-0 text-right font-mono text-[10px] font-semibold tabular-nums",
                      cat.trend === "down" ? "text-success" : cat.trend === "up" ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {cat.trend === "up" ? "▲" : cat.trend === "down" ? "▼" : "─"}{cat.trendPercentage.toFixed(0)}%
                    </span>
                  ) : (
                    <span className="w-10 shrink-0 text-right text-[10px] text-muted-foreground/50">—</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); openCategoryDetail(cat); }}
                    className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Ver detalle de ${cat.category}`}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </SectionCard>

          <SectionCard title="Presupuesto por categoría" flush={hasBudget}>
            {!hasBudget ? (
              <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Sin presupuesto configurado
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/budget">🎯 Configurar</Link>
                </Button>
              </div>
            ) : (
              categoryBreakdown.map((cat) => {
                const usage = cat.limitUsage ?? 0;
                const hasLimit = !!cat.limit;
                return (
                  <div
                    key={cat.category}
                    className="flex items-center gap-2 border-b border-border px-4 py-1.5 transition-colors last:border-b-0 hover:bg-muted"
                  >
                    <span className="shrink-0 text-sm leading-none">{getCatEmoji(cat.category, categories)}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {cat.category}
                    </span>
                    {hasLimit ? (
                      <>
                        <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-sm bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-sm transition-all",
                              cat.isOverLimit ? "bg-destructive" : cat.isNearLimit ? "bg-warning" : "bg-success"
                            )}
                            style={{ width: `${Math.min(usage, 100)}%` }}
                          />
                        </div>
                        <span className={cn(
                          "w-10 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums",
                          cat.isOverLimit ? "text-destructive" : cat.isNearLimit ? "text-warning" : "text-success"
                        )}>
                          {usage.toFixed(0)}%
                        </span>
                        <span className={cn(
                          "w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground",
                          isPrivacyMode && "privacy-blur"
                        )}>
                          {formatCompact(cat.effectiveAmount)}/{formatCompact(cat.limit!)}
                        </span>
                      </>
                    ) : (
                      <span className="shrink-0 text-[10px] text-muted-foreground/40">
                        sin límite
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </SectionCard>
        </Row>
      )}

      {activeTab === "historico" && !isLoading && (
        /* Si no hay gasto acumulado, la fila es de una sola celda: dos
                  columnas con una vacía dejaría un hueco del color del borde. */
        <Row
          className={cn(
            "border-b border-border",
            expensesByCategory.length > 0 && "lg:grid-cols-2"
          )}
        >
          {expensesByCategory.length > 0 && (
            <SectionCard title="Gasto acumulado por categoría" tooltip="Top categorías con mayor gasto en todo tu historial" flush>
              {expensesByCategory.map((cat) => {
                const maxVal = expensesByCategory[0]?.value || 1;
                return (
                  <div
                    key={cat.name}
                    className="flex items-center gap-2 border-b border-border px-4 py-1.5 transition-colors last:border-b-0 hover:bg-muted"
                  >
                    <span className="shrink-0 text-sm leading-none">{getCatEmoji(cat.name, categories)}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {cat.name}
                    </span>
                    <div className="h-1 w-16 shrink-0 overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-full rounded-sm"
                        style={{ width: `${(cat.value / maxVal) * 100}%`, backgroundColor: cat.color }}
                      />
                    </div>
                    <span className={cn(
                      "w-[72px] shrink-0 text-right font-mono text-xs font-semibold tabular-nums",
                      isPrivacyMode && "privacy-blur"
                    )}>
                      {formatCurrency(cat.value)}
                    </span>
                  </div>
                );
              })}
            </SectionCard>
          )}

          <SectionCard title="Proyección financiera" tooltip="Proyección de patrimonio basada en tu historial">
            <ProjectionCard />
          </SectionCard>
        </Row>
      )}

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
