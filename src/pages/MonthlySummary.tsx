import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { GlassCard } from "@/components/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import {
  useMonthlySummary,
  type CategoryBreakdown,
  type DailySpending,
} from "@/hooks/useMonthlySummary";
import { CHART_COLORS } from "@/lib/chart-config";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { format, subMonths, addMonths } from "date-fns";
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
} from "lucide-react";
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
      <div className="flex items-center gap-2 px-6 pt-5 pb-2 border-b border-border/20">
        {Icon && <Icon className="h-3.5 w-3.5 text-primary/60" />}
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex-1 p-6 pt-4">{children}</div>
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
  const delta = prev !== 0 ? ((value - prev) / Math.abs(prev)) * 100 : 0;
  const isPositive = delta > 0;
  const isGood = invertDelta ? !isPositive : isPositive;
  const showDelta = prev !== 0;

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
            <div className="relative p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("p-1.5 rounded-lg", iconBg)}>
                  <Icon className={cn("h-3.5 w-3.5", iconColor)} />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {label}
                </span>
              </div>
              <div
                className={cn(
                  "text-2xl font-bold font-mono tabular-nums",
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
                <div className="mt-2 flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md",
                      isGood
                        ? "text-emerald-600 bg-emerald-500/10"
                        : "text-rose-600 bg-rose-500/10"
                    )}
                  >
                    {isPositive ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground">
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

export default function MonthlySummary() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const { transactions, isLoading } = useTransactions();
  const { categories } = useCategories();
  const { limits } = useCategoryLimits();
  const { creditCards } = useCreditCards();
  const { isPrivacyMode } = usePrivacyMode();

  const { kpis, categoryBreakdown, dailySpending, dailyStats, cardSpending, transactionCount } =
    useMonthlySummary(transactions, categories, limits, selectedMonth);

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

  // Donut chart data (top 5 + others)
  const donutData = useMemo(() => {
    if (categoryBreakdown.length <= 6) return categoryBreakdown;
    const top5 = categoryBreakdown.slice(0, 5);
    const others = categoryBreakdown.slice(5);
    const othersTotal = others.reduce((s, c) => s + c.amount, 0);
    const totalExp = categoryBreakdown.reduce((s, c) => s + c.amount, 0);
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
  }, [categoryBreakdown]);

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

  return (
    <Layout>
      <div className="space-y-6">
        {/* ─── Header ────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">
              Resumen Mensual
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Cargando..."
                : `${transactionCount} movimientos en ${format(selectedMonth, "MMMM", { locale: es })}`}
            </p>
          </div>

          {/* Month Navigator */}
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

        {/* ─── Loading State ─────────────────────────── */}
        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          /* ─── Empty State ────────────────────────── */
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
            {/* ─── KPI Cards ───────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {kpiCards.map((card) => (
                <KPICard
                  key={card.label}
                  {...card}
                  prevMonthLabel={prevMonthLabel}
                  isPrivacyMode={isPrivacyMode}
                />
              ))}
            </div>

            {/* ─── Savings Rate Banner ─────────────── */}
            {kpis.income > 0 && (
              <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-r from-violet-500/[0.03] via-card to-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-500/10">
                      <Target className="h-4 w-4 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                        Tasa de Ahorro
                      </p>
                      <div
                        className={cn(
                          "text-xl font-bold font-mono tabular-nums",
                          kpis.savingsRate >= 0
                            ? "text-violet-500"
                            : "text-rose-500",
                          isPrivacyMode && "privacy-blur"
                        )}
                      >
                        <NumberFlow
                          value={kpis.savingsRate}
                          format={{ maximumFractionDigits: 1 }}
                        />
                        %
                      </div>
                    </div>
                  </div>
                  {kpis.prevSavingsRate !== 0 && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Mes anterior
                      </p>
                      <p
                        className={cn(
                          "text-sm font-mono tabular-nums text-muted-foreground",
                          isPrivacyMode && "privacy-blur"
                        )}
                      >
                        {kpis.prevSavingsRate.toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Row 1: Donut + Comparison ─────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Donut Chart */}
              <div className="lg:col-span-7">
                <SectionCard
                  title="Gastos por Categoría"
                  tooltip="Distribución de gastos del mes por categoría"
                >
                  {categoryBreakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Sin gastos registrados
                    </p>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="relative w-full max-w-[280px]">
                        <ResponsiveContainer width="100%" height={280}>
                          <PieChart>
                            <Pie
                              data={donutData}
                              dataKey="amount"
                              nameKey="category"
                              cx="50%"
                              cy="50%"
                              innerRadius={75}
                              outerRadius={110}
                              paddingAngle={3}
                              strokeWidth={0}
                              className={cn(
                                isPrivacyMode && "privacy-blur"
                              )}
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
                        {/* Center label */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="text-center">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              Total
                            </p>
                            <p
                              className={cn(
                                "text-lg font-bold font-mono tabular-nums",
                                isPrivacyMode && "privacy-blur"
                              )}
                            >
                              {formatCompact(kpis.expenses)}
                            </p>
                          </div>
                        </div>
                      </div>
                      {/* Legend */}
                      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                        {donutData.map((cat) => (
                          <div
                            key={cat.category}
                            className="flex items-center gap-1.5"
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {cat.category}
                            </span>
                            <span className="text-xs font-semibold tabular-nums">
                              {cat.percentage.toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </SectionCard>
              </div>

              {/* Comparison */}
              <div className="lg:col-span-5">
                <SectionCard
                  title="vs Mes Anterior"
                  icon={ArrowRight}
                  tooltip={`Comparación con ${prevMonthLabel}`}
                >
                  <div className="space-y-5">
                    {comparisonData.map((item) => {
                      const maxVal =
                        Math.max(item.current, item.previous) || 1;
                      return (
                        <div key={item.label} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {item.label}
                            </span>
                            <span
                              className={cn(
                                "text-sm font-mono font-semibold tabular-nums",
                                isPrivacyMode && "privacy-blur"
                              )}
                            >
                              {formatCompact(item.current)}
                            </span>
                          </div>
                          {/* Current bar */}
                          <div className="h-3 rounded-full bg-muted/60 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{
                                width: `${(item.current / maxVal) * 100}%`,
                                backgroundColor: item.color,
                              }}
                            />
                          </div>
                          {/* Previous bar */}
                          <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
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
                                "text-[10px] text-muted-foreground",
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
                                  "text-xs font-semibold",
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
                    {/* Insight */}
                    {summaryInsight && (
                      <div
                        className={cn(
                          "mt-4 px-3 py-2.5 rounded-lg text-xs font-medium border",
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

            {/* ─── Row 2: Daily Spending + Credit Cards ── */}
            <div
              className={cn(
                "grid grid-cols-1 gap-6",
                monthlyCardSpending.length > 0 && "lg:grid-cols-12"
              )}
            >
              {/* Daily Spending */}
              <div
                className={cn(
                  monthlyCardSpending.length > 0 ? "lg:col-span-8" : ""
                )}
              >
                <SectionCard
                  title="Gasto Diario"
                  tooltip="Gasto por día del mes. La línea punteada es el promedio diario"
                >
                  {dailySpending.length > 0 ? (
                    <div>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={dailySpending}
                          className={cn(
                            isPrivacyMode && "privacy-blur"
                          )}
                        >
                          <XAxis
                            dataKey="day"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            stroke={CHART_COLORS.mutedAxis}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            stroke={CHART_COLORS.mutedAxis}
                            tickFormatter={formatCompact}
                            width={50}
                          />
                          <ChartTooltip content={<DailyTooltip />} />
                          <ReferenceLine
                            y={dailyStats.avgDaily}
                            stroke={CHART_COLORS.balance}
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                          />
                          <Bar
                            dataKey="amount"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={16}
                          >
                            {dailySpending.map((entry, i) => (
                              <Cell
                                key={i}
                                fill={CHART_COLORS.expense}
                                opacity={
                                  entry.amount === 0
                                    ? 0.08
                                    : entry.isWeekend
                                    ? 0.55
                                    : 1
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      {/* Stats row */}
                      <div className="flex items-center gap-6 mt-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-[2px] bg-amber-500 rounded" style={{ borderTop: "2px dashed" }} />
                          <span>
                            Promedio:{" "}
                            <span
                              className={cn(
                                "font-semibold text-foreground font-mono tabular-nums",
                                isPrivacyMode && "privacy-blur"
                              )}
                            >
                              {formatCompact(dailyStats.avgDaily)}/día
                            </span>
                          </span>
                        </div>
                        {dailyStats.peakDay && (
                          <div>
                            Pico:{" "}
                            <span
                              className={cn(
                                "font-semibold text-foreground font-mono tabular-nums",
                                isPrivacyMode && "privacy-blur"
                              )}
                            >
                              {formatCompact(dailyStats.peakDay.amount)}
                            </span>{" "}
                            <span className="capitalize">
                              ({dailyStats.peakDay.date})
                            </span>
                          </div>
                        )}
                        <div>
                          {dailyStats.daysWithSpending} de{" "}
                          {dailyStats.totalDays} días con gasto
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Sin gastos registrados
                    </p>
                  )}
                </SectionCard>
              </div>

              {/* Credit Cards */}
              {monthlyCardSpending.length > 0 && (
                <div className="lg:col-span-4">
                  <SectionCard title="Tarjetas" icon={CreditCard}>
                    <div className="space-y-5">
                      {monthlyCardSpending.map((card) => {
                        const usage =
                          card.credit_limit > 0
                            ? (card.spent / card.credit_limit) * 100
                            : 0;
                        return (
                          <div key={card.id} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{
                                    backgroundColor:
                                      card.color || "#6b7280",
                                  }}
                                />
                                <span className="text-sm font-medium">
                                  {card.name}
                                </span>
                              </div>
                              <span
                                className={cn(
                                  "text-sm font-mono font-semibold tabular-nums",
                                  isPrivacyMode && "privacy-blur"
                                )}
                              >
                                {formatCompact(card.spent)}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${Math.min(usage, 100)}%`,
                                  backgroundColor:
                                    card.color || "#6b7280",
                                }}
                              />
                            </div>
                            <p
                              className={cn(
                                "text-[10px] text-muted-foreground text-right tabular-nums",
                                isPrivacyMode && "privacy-blur"
                              )}
                            >
                              {usage.toFixed(0)}% del límite (
                              {formatCompact(card.credit_limit)})
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>
                </div>
              )}
            </div>

            {/* ─── Category Detail Table ─────────────── */}
            {categoryBreakdown.length > 0 && (
              <SectionCard title="Detalle por Categoría">
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-3 pr-4">
                          Categoría
                        </th>
                        <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-3 px-4">
                          Monto
                        </th>
                        <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-3 px-4 hidden sm:table-cell">
                          % Total
                        </th>
                        <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-3 px-4 hidden md:table-cell">
                          # Mov
                        </th>
                        <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-3 px-4">
                          vs Anterior
                        </th>
                        <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-3 pl-4 hidden sm:table-cell">
                          Límite
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryBreakdown.map((cat) => (
                        <tr
                          key={cat.category}
                          className="border-b border-border/10 hover:bg-accent/50 transition-colors"
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor: cat.color,
                                }}
                              />
                              <span className="text-sm font-medium truncate max-w-[160px]">
                                {cat.category}
                              </span>
                            </div>
                          </td>
                          <td className="text-right py-3 px-4">
                            <span
                              className={cn(
                                "text-sm font-mono font-semibold tabular-nums",
                                isPrivacyMode && "privacy-blur"
                              )}
                            >
                              {formatCurrency(cat.amount)}
                            </span>
                          </td>
                          <td className="text-right py-3 px-4 hidden sm:table-cell">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${cat.percentage}%`,
                                    backgroundColor: cat.color,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">
                                {cat.percentage.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="text-right py-3 px-4 hidden md:table-cell">
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {cat.count}
                            </span>
                          </td>
                          <td className="text-right py-3 px-4">
                            {cat.prevAmount > 0 ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-0.5 text-xs font-semibold",
                                  cat.trend === "down"
                                    ? "text-emerald-500"
                                    : cat.trend === "up"
                                    ? "text-rose-500"
                                    : "text-muted-foreground"
                                )}
                              >
                                {cat.trend === "up"
                                  ? "▲"
                                  : cat.trend === "down"
                                  ? "▼"
                                  : "─"}{" "}
                                {cat.trendPercentage.toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                nueva
                              </span>
                            )}
                          </td>
                          <td className="text-right py-3 pl-4 hidden sm:table-cell">
                            {cat.limit ? (
                              <span
                                className={cn(
                                  "text-xs font-semibold px-2 py-0.5 rounded-full",
                                  cat.isOverLimit
                                    ? "text-rose-600 bg-rose-500/10"
                                    : cat.isNearLimit
                                    ? "text-amber-600 bg-amber-500/10"
                                    : "text-emerald-600 bg-emerald-500/10"
                                )}
                              >
                                {cat.limitUsage?.toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
