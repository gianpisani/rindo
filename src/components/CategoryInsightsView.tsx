import { useState, useMemo } from "react";
import { GlassCard } from "./GlassCard";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Skeleton } from "./ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";
import { useCategoryInsights } from "@/hooks/useCategoryInsights";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { useMonthlyBudget } from "@/hooks/useMonthlyBudget";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { cn } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/chart-config";
import NumberFlow from "@number-flow/react";
import {
  Target,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Pencil,
  Check,
  Info,
  TrendingUp,
  TrendingDown,
  BarChart3,
  SlidersHorizontal,
} from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  getDaysInMonth,
  isSameMonth,
  setDate,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Checkbox } from "./ui/checkbox";
import {
  ComposedChart,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Legend,
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

const FALLBACK_COLOR = "#6b7280";
const ROSE = "oklch(var(--accent-rose))";
const AMBER = "oklch(var(--accent-amber))";

// ─── Section Card ────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  tooltip,
  action,
  children,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  tooltip?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={cn("flex flex-col", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-y-2 px-4 pt-3 pb-1.5 border-b border-border/20">
        <div className="flex items-center gap-2">
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
        {action && <div className="sm:ml-auto">{action}</div>}
      </div>
      <div className="flex-1 p-4 pt-3">{children}</div>
    </GlassCard>
  );
}

// ─── Evolution Chart Tooltip ─────────────────────────────

function EvolutionTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/50 rounded-xl p-3 shadow-lg">
      <p className="font-semibold text-sm text-foreground capitalize mb-1">
        {label}
      </p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-semibold tabular-nums">
            {formatCurrency(entry.value as number)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Envelope Sparkline ──────────────────────────────────
// Mini burn-down: cumulative category spending vs the ideal
// diagonal towards its limit. Pure SVG, no chart lib overhead.

function EnvelopeSparkline({
  txs,
  daysInMonth,
  endDay,
  limit,
  color,
}: {
  txs: Transaction[];
  daysInMonth: number;
  endDay: number;
  limit: number;
  color: string;
}) {
  const points = useMemo(() => {
    const daily = new Array(daysInMonth + 1).fill(0);
    txs.forEach((t) => {
      const day = new Date(t.date).getDate();
      if (day >= 1 && day <= daysInMonth) daily[day] += Number(t.amount);
    });
    const cumulative = [0];
    let cum = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      cum += daily[d];
      cumulative.push(cum);
    }
    return cumulative;
  }, [txs, daysInMonth]);

  const W = 100;
  const H = 28;
  const scale = Math.max(limit, points[daysInMonth]) || 1;
  const x = (d: number) => (d / daysInMonth) * W;
  const y = (v: number) => H - 2 - (v / scale) * (H - 4);

  const actual = Array.from({ length: endDay + 1 }, (_, d) =>
    `${x(d).toFixed(1)},${y(points[d]).toFixed(1)}`
  ).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-7"
      aria-hidden="true"
    >
      {/* Ideal pace towards the limit */}
      <line
        x1={0}
        y1={y(0)}
        x2={W}
        y2={y(limit)}
        stroke="currentColor"
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
        className="text-border"
      />
      <polygon
        points={`0,${H} ${actual} ${x(endDay).toFixed(1)},${H}`}
        fill={color}
        opacity={0.08}
      />
      <polyline
        points={actual}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────

export function CategoryInsightsView() {
  const { transactions, isLoading } = useTransactions();
  const { categories } = useCategories();
  const { limits, upsertLimit, deleteLimit } = useCategoryLimits();
  const { budget, upsertBudget } = useMonthlyBudget();
  const { isPrivacyMode } = usePrivacyMode();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [simInput, setSimInput] = useState("");
  const [simCategory, setSimCategory] = useState<string>("none");
  const [selectedChartCategories, setSelectedChartCategories] = useState<Set<string>>(new Set());
  const [chartMonths, setChartMonths] = useState(6);
  const [showAverage, setShowAverage] = useState(false);
  const [limitFormData, setLimitFormData] = useState({
    category: "",
    limit: "",
    alertPercentage: 80,
  });

  const { categorySpending, monthlyComparison } = useCategoryInsights(
    transactions,
    limits,
    selectedMonth,
    chartMonths
  );

  const totalAllocated = limits.reduce((s, l) => s + l.monthly_limit, 0);
  const totalBudget = budget?.total_budget || 0;
  const unallocated = totalBudget - totalAllocated;

  const isCurrentMonth =
    format(selectedMonth, "yyyy-MM") === format(new Date(), "yyyy-MM");

  // ── Month clock ──
  const daysInMonth = getDaysInMonth(selectedMonth);
  const todayDay = isCurrentMonth ? new Date().getDate() : daysInMonth;
  const daysLeft = Math.max(daysInMonth - todayDay + 1, 1); // includes today

  // ── Daily net spending (Gastos minus reimbursements, by day) ──
  const dailyNet = useMemo(() => {
    const arr = new Array(daysInMonth + 1).fill(0);
    transactions.forEach((t) => {
      const d = new Date(t.date);
      if (!isSameMonth(d, selectedMonth)) return;
      const day = d.getDate();
      if (t.type === "Gasto") arr[day] += Number(t.amount);
      else if (t.type === "Ingreso" && t.reimbursement_for_category)
        arr[day] -= Number(t.amount);
    });
    return arr;
  }, [transactions, selectedMonth, daysInMonth]);

  // ── Simulation ("¿Me alcanza?") ──
  const simAmount = parseInt(simInput.replace(/\D/g, ""), 10) || 0;
  const isSimulating = isCurrentMonth && simAmount > 0;

  // ── Burn-down series ──
  const {
    chartData,
    spent,
    projectedEnd,
    maxY,
  } = useMemo(() => {
    let cum = 0;
    let cumAtToday = 0;
    for (let day = 1; day <= todayDay; day++) cum += dailyNet[day];
    cumAtToday = cum;
    for (let day = todayDay + 1; day <= daysInMonth; day++) cum += dailyNet[day];
    const cumEnd = cum;

    const pace = todayDay > 0 ? cumAtToday / todayDay : 0;
    const sim = isCurrentMonth ? simAmount : 0;
    const projectedEnd = isCurrentMonth
      ? cumAtToday + sim + pace * (daysInMonth - todayDay)
      : null;

    const rows = [];
    let running = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      running += dailyNet[day];
      rows.push({
        day,
        spentDay: dailyNet[day],
        actual: !isCurrentMonth || day <= todayDay ? running : null,
        ideal: totalBudget > 0 ? (totalBudget * day) / daysInMonth : null,
        projected:
          isCurrentMonth && day >= todayDay
            ? cumAtToday + sim + pace * (day - todayDay)
            : null,
      });
    }

    const spent = isCurrentMonth ? cumAtToday : cumEnd;
    const maxY =
      Math.max(totalBudget, cumEnd, projectedEnd ?? 0, 1) * 1.06;

    return { chartData: rows, spent, projectedEnd, maxY };
  }, [dailyNet, daysInMonth, todayDay, isCurrentMonth, totalBudget, simAmount]);

  const remaining = totalBudget - spent;
  const usagePercent = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;
  const perDay = Math.max(0, remaining) / daysLeft;
  const perDayAfterSim = Math.max(0, remaining - simAmount) / daysLeft;
  const heroPerDay = isSimulating ? perDayAfterSim : perDay;
  const projectionOnTrack =
    projectedEnd !== null && totalBudget > 0 && projectedEnd <= totalBudget;

  // ── Simulation verdict ──
  const simEnvelope =
    simCategory !== "none"
      ? categorySpending.find((c) => c.category === simCategory && c.limit)
      : undefined;

  const simVerdict = useMemo(() => {
    if (!isSimulating || totalBudget <= 0) return null;
    const afterRemaining = remaining - simAmount;
    const envelopeAfter = simEnvelope
      ? simEnvelope.effectiveAmount + simAmount
      : null;
    const envelopeBreaks =
      simEnvelope && envelopeAfter! > simEnvelope.limit!;

    if (afterRemaining < 0) {
      return {
        tone: "rose" as const,
        text: `No alcanza: te pasarías del presupuesto por ${formatCompact(-afterRemaining)}.`,
      };
    }
    if (envelopeBreaks) {
      return {
        tone: "amber" as const,
        text: `Alcanza, pero ${simEnvelope!.category} quedaría excedida en ${formatCompact(envelopeAfter! - simEnvelope!.limit!)}. Tu día baja a ${formatCurrency(Math.round(perDayAfterSim))}.`,
      };
    }
    if (perDayAfterSim < perDay * 0.55) {
      return {
        tone: "amber" as const,
        text: `Alcanza, pero aprieta: tu día baja de ${formatCurrency(Math.round(perDay))} a ${formatCurrency(Math.round(perDayAfterSim))}.`,
      };
    }
    return {
      tone: "emerald" as const,
      text: `Te alcanza. Tu día queda en ${formatCurrency(Math.round(perDayAfterSim))}${simEnvelope ? ` y ${simEnvelope.category} al ${Math.round((envelopeAfter! / simEnvelope.limit!) * 100)}%` : ""}.`,
    };
  }, [isSimulating, totalBudget, remaining, simAmount, simEnvelope, perDay, perDayAfterSim]);

  // ── Budget CRUD ──
  const handleSaveBudget = async () => {
    const value = parseInt(budgetInput.replace(/\D/g, ""), 10);
    if (!isNaN(value) && value > 0) {
      await upsertBudget.mutateAsync(value);
    }
    setEditingBudget(false);
  };

  const startEditBudget = () => {
    setBudgetInput(budget?.total_budget?.toString() || "");
    setEditingBudget(true);
  };

  // ── Limit CRUD ──
  const handleSetLimit = (category: string) => {
    const existingLimit = limits.find((l) => l.category_name === category);
    setLimitFormData({
      category,
      limit: existingLimit?.monthly_limit.toString() || "",
      alertPercentage: existingLimit?.alert_at_percentage || 80,
    });
    setIsLimitDialogOpen(true);
  };

  const openNewLimitDialog = () => {
    setLimitFormData({ category: "", limit: "", alertPercentage: 80 });
    setIsLimitDialogOpen(true);
  };

  const handleSaveLimit = async () => {
    if (!limitFormData.category || !limitFormData.limit) return;
    await upsertLimit.mutateAsync({
      category_name: limitFormData.category,
      monthly_limit: parseFloat(limitFormData.limit),
      alert_at_percentage: limitFormData.alertPercentage,
    });
    setIsLimitDialogOpen(false);
    setLimitFormData({ category: "", limit: "", alertPercentage: 80 });
  };

  const handleDeleteLimit = async (categoryName: string) => {
    const limit = limits.find((l) => l.category_name === categoryName);
    if (!limit) return;
    await deleteLimit.mutateAsync(limit.id);
  };

  const expenseCategories = useMemo(() => {
    return categories
      .filter((c) => c.type === "Gasto")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  const categoryColor = (name: string) =>
    categories.find((c) => c.name === name)?.color || FALLBACK_COLOR;
  const categoryEmoji = (name: string) =>
    categories.find((c) => c.name === name)?.icon || "🏷️";

  // Envelopes: categories with limits, most pressured first
  const envelopes = useMemo(() => {
    return categorySpending
      .filter((c) => c.limit)
      .sort(
        (a, b) => b.effectiveAmount / b.limit! - a.effectiveAmount / a.limit!
      );
  }, [categorySpending]);

  const categoriesWithoutLimits = categorySpending.filter(
    (c) => !c.limit && c.count > 0
  );

  // ── Evolution chart data ──
  const top5Categories = useMemo(() => {
    const categorySums = categorySpending.map((cat) => {
      const total = monthlyComparison.reduce(
        (sum, month) => sum + (month.categories[cat.category] || 0),
        0
      );
      return { category: cat.category, total };
    });
    return categorySums
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((c) => c.category);
  }, [categorySpending, monthlyComparison]);

  const availableChartCategories = useMemo(() => {
    return categorySpending
      .filter((cat) =>
        monthlyComparison.some((m) => (m.categories[cat.category] || 0) > 0)
      )
      .map((c) => c.category);
  }, [categorySpending, monthlyComparison]);

  const activeChartCategories = useMemo(() => {
    return selectedChartCategories.size > 0
      ? availableChartCategories.filter((c) => selectedChartCategories.has(c))
      : top5Categories;
  }, [selectedChartCategories, availableChartCategories, top5Categories]);

  const categoryAverages = useMemo(() => {
    const avgs: Record<string, number> = {};
    activeChartCategories.forEach((cat) => {
      const values = monthlyComparison
        .map((m) => m.categories[cat] || 0)
        .filter((v) => v > 0);
      avgs[cat] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    });
    return avgs;
  }, [activeChartCategories, monthlyComparison]);

  const comparisonChartData = useMemo(() => {
    return monthlyComparison.map((month) => {
      const data: Record<string, string | number> = { month: month.month };
      categorySpending.forEach((cat) => {
        data[cat.category] = month.categories[cat.category] || 0;
      });
      if (showAverage) {
        activeChartCategories.forEach((cat) => {
          data[`${cat}_avg`] = categoryAverages[cat] || 0;
        });
      }
      return data;
    });
  }, [monthlyComparison, categorySpending, showAverage, activeChartCategories, categoryAverages]);

  const categoryLineColors = useMemo(() => {
    const colors: Record<string, string> = {};
    availableChartCategories.forEach((cat) => {
      colors[cat] = categoryColor(cat);
    });
    return colors;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableChartCategories, categories]);

  const changeMonth = (delta: number) => {
    setSelectedMonth((prev) =>
      delta > 0 ? addMonths(prev, 1) : subMonths(prev, 1)
    );
  };

  // ── Burn-down tooltip (needs selectedMonth from closure) ──
  function BurndownTooltip({ active, payload }: TooltipProps<number, string>) {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as (typeof chartData)[number];
    const isFuture = isCurrentMonth && row.day > todayDay;
    const cumulative = isFuture ? row.projected : row.actual;
    const delta =
      !isFuture && row.ideal !== null && row.actual !== null
        ? row.actual - row.ideal
        : null;
    return (
      <div className="bg-card border border-border/50 rounded-xl p-3 shadow-lg">
        <p className="font-semibold text-sm text-foreground capitalize mb-1">
          {format(setDate(selectedMonth, row.day), "EEEE d 'de' MMMM", {
            locale: es,
          })}
        </p>
        <div className={cn("space-y-0.5 text-xs", isPrivacyMode && "privacy-blur")}>
          {isFuture ? (
            <p className="text-muted-foreground">
              Proyección:{" "}
              <span className="font-mono font-semibold tabular-nums text-foreground">
                ~{formatCurrency(Math.round(cumulative ?? 0))}
              </span>
            </p>
          ) : (
            <>
              {row.spentDay !== 0 && (
                <p className="text-muted-foreground">
                  Gastado ese día:{" "}
                  <span className="font-mono font-semibold tabular-nums text-foreground">
                    {formatCurrency(row.spentDay)}
                  </span>
                </p>
              )}
              <p className="text-muted-foreground">
                Acumulado:{" "}
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {formatCurrency(Math.round(cumulative ?? 0))}
                </span>
              </p>
              {delta !== null && Math.abs(delta) > 500 && (
                <p
                  className={cn(
                    "font-medium",
                    delta > 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-500"
                  )}
                >
                  {formatCompact(Math.abs(delta))}{" "}
                  {delta > 0 ? "sobre el ritmo" : "bajo el ritmo"}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  const xTicks = useMemo(() => {
    const ticks = [1, 5, 10, 15, 20, 25];
    if (!ticks.includes(daysInMonth)) ticks.push(daysInMonth);
    return ticks.filter((t) => t <= daysInMonth);
  }, [daysInMonth]);

  return (
    <div className="space-y-4">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Presupuesto</h1>

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
              "min-w-[150px] sm:min-w-[180px] text-center px-3 py-1.5 rounded-lg transition-colors",
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

      {/* ─── Copiloto ────────────────────────────────────── */}
      {isLoading ? (
        <GlassCard className="px-4 py-5 sm:px-6">
          <Skeleton className="h-3 w-32 mb-2" />
          <Skeleton className="h-10 w-56 mb-5" />
          <Skeleton className="h-[220px] w-full rounded-lg mb-3" />
          <Skeleton className="h-3 w-64" />
        </GlassCard>
      ) : totalBudget <= 0 ? (
        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent pointer-events-none" />
          <div className="relative flex flex-col items-center text-center px-4 py-10">
            <div className="p-3 rounded-full bg-primary/10 mb-3">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-base font-semibold mb-1">
              Define tu presupuesto mensual
            </h2>
            <p className="text-xs text-muted-foreground mb-4 max-w-[300px]">
              Es el total que planeas gastar cada mes. Con eso te digo cuánto
              puedes gastar cada día sin romper el mes.
            </p>
            <div className="flex items-center gap-2 w-full max-w-[280px]">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  value={
                    budgetInput
                      ? parseInt(budgetInput.replace(/\D/g, ""), 10).toLocaleString("es-CL")
                      : ""
                  }
                  placeholder="1.500.000"
                  onChange={(e) => setBudgetInput(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveBudget();
                  }}
                  className="pl-7 h-9 font-mono text-sm"
                />
              </div>
              <Button
                size="sm"
                className="h-9 rounded-lg"
                disabled={!budgetInput}
                onClick={handleSaveBudget}
              >
                Guardar
              </Button>
            </div>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent pointer-events-none" />
          <div className="relative px-4 py-4 sm:px-6 sm:py-5">
            {/* Top row: today's allowance + editable budget */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  {isCurrentMonth
                    ? remaining >= 0
                      ? "Puedes gastar hoy"
                      : "Presupuesto excedido"
                    : remaining >= 0
                    ? "Sobró del presupuesto"
                    : "Excedido ese mes"}
                  {isSimulating && (
                    <span className="text-amber-500 normal-case tracking-normal font-medium">
                      · simulando
                    </span>
                  )}
                </p>
                {isCurrentMonth && remaining >= 0 ? (
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        "text-3xl sm:text-4xl font-bold font-mono tabular-nums tracking-tight leading-none",
                        isSimulating && "text-amber-500",
                        isPrivacyMode && "privacy-blur"
                      )}
                    >
                      $
                      <NumberFlow
                        value={Math.round(heroPerDay)}
                        format={{
                          style: "decimal",
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }}
                        locales="es-CL"
                      />
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">
                      /día
                    </span>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "text-3xl sm:text-4xl font-bold font-mono tabular-nums tracking-tight leading-none",
                      remaining < 0 && "text-rose-500",
                      isPrivacyMode && "privacy-blur"
                    )}
                  >
                    {remaining < 0 && "−"}$
                    <NumberFlow
                      value={Math.abs(Math.round(remaining))}
                      format={{
                        style: "decimal",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }}
                      locales="es-CL"
                    />
                  </div>
                )}
                <p
                  className={cn(
                    "text-[11px] text-muted-foreground mt-1.5 font-mono tabular-nums",
                    isPrivacyMode && "privacy-blur"
                  )}
                >
                  {isCurrentMonth
                    ? remaining >= 0
                      ? `queda ${formatCompact(remaining)} ÷ ${daysLeft} ${daysLeft === 1 ? "día" : "días"}`
                      : `a ${daysLeft} ${daysLeft === 1 ? "día" : "días"} del cierre`
                    : `gastaste ${formatCompact(spent)} de ${formatCompact(totalBudget)}`}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Presupuesto
                </p>
                {editingBudget ? (
                  <div className="flex items-center gap-1">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        $
                      </span>
                      <Input
                        value={
                          budgetInput
                            ? parseInt(budgetInput.replace(/\D/g, ""), 10).toLocaleString("es-CL")
                            : ""
                        }
                        onChange={(e) =>
                          setBudgetInput(e.target.value.replace(/\D/g, ""))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveBudget();
                          if (e.key === "Escape") setEditingBudget(false);
                        }}
                        className="pl-6 w-36 text-sm font-mono h-8"
                        autoFocus
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={handleSaveBudget}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setEditingBudget(false)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={startEditBudget}
                    className="group flex items-center gap-1.5 rounded-lg px-2 py-1 -mr-2 hover:bg-accent transition-colors"
                  >
                    <span
                      className={cn(
                        "text-base font-semibold font-mono tabular-nums",
                        isPrivacyMode && "privacy-blur"
                      )}
                    >
                      {formatCurrency(totalBudget)}
                    </span>
                    <Pencil className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                  </button>
                )}
              </div>
            </div>

            {/* Burn-down chart */}
            <div className={cn("mt-4 -mx-2", isPrivacyMode && "privacy-blur")}>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 12, right: 8, bottom: 0, left: 8 }}
                >
                  <defs>
                    <linearGradient id="burnFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={CHART_COLORS.expense}
                        stopOpacity={0.14}
                      />
                      <stop
                        offset="100%"
                        stopColor={CHART_COLORS.expense}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    ticks={xTicks}
                    stroke={CHART_COLORS.mutedAxis}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis hide domain={[0, maxY]} />
                  <ChartTooltip content={<BurndownTooltip />} />

                  {/* Budget ceiling */}
                  <ReferenceLine
                    y={totalBudget}
                    stroke={CHART_COLORS.mutedAxis}
                    strokeDasharray="2 5"
                    strokeOpacity={0.6}
                    label={{
                      value: "Presupuesto",
                      position: "insideTopRight",
                      fontSize: 9,
                      fill: CHART_COLORS.mutedAxis,
                    }}
                  />

                  {/* Today marker */}
                  {isCurrentMonth && (
                    <ReferenceLine
                      x={todayDay}
                      stroke={CHART_COLORS.mutedAxis}
                      strokeOpacity={0.45}
                      label={{
                        value: "Hoy",
                        position: "insideBottom",
                        fontSize: 9,
                        fill: CHART_COLORS.mutedAxis,
                      }}
                    />
                  )}

                  {/* Ideal pace */}
                  <Line
                    type="linear"
                    dataKey="ideal"
                    stroke={CHART_COLORS.mutedAxis}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    strokeOpacity={0.55}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />

                  {/* Projection at current pace (+ simulation) */}
                  {isCurrentMonth && (
                    <Line
                      type="linear"
                      dataKey="projected"
                      stroke={
                        projectionOnTrack
                          ? CHART_COLORS.income
                          : CHART_COLORS.expense
                      }
                      strokeWidth={1.5}
                      strokeDasharray="2 4"
                      dot={false}
                      activeDot={{ r: 3 }}
                      isAnimationActive={false}
                    />
                  )}

                  {/* Actual cumulative spending */}
                  <Area
                    type="monotone"
                    dataKey="actual"
                    stroke={CHART_COLORS.expense}
                    strokeWidth={2}
                    fill="url(#burnFill)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Stats row */}
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
              <span className="flex items-baseline gap-1.5">
                <span className="text-muted-foreground">Gastado</span>
                <span
                  className={cn(
                    "font-mono font-semibold tabular-nums",
                    isPrivacyMode && "privacy-blur"
                  )}
                >
                  {formatCompact(spent)}
                </span>
                <span className="text-muted-foreground/60 tabular-nums">
                  {usagePercent.toFixed(0)}%
                </span>
              </span>
              {projectedEnd !== null && (
                <span className="flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "size-1.5 rounded-full self-center shrink-0",
                      projectionOnTrack ? "bg-emerald-500" : "bg-rose-500"
                    )}
                  />
                  <span className="text-muted-foreground">Cierre proyectado</span>
                  <span
                    className={cn(
                      "font-mono font-semibold tabular-nums",
                      !projectionOnTrack && "text-rose-500",
                      isPrivacyMode && "privacy-blur"
                    )}
                  >
                    ~{formatCompact(projectedEnd)}
                  </span>
                </span>
              )}
              <span className="flex items-baseline gap-1.5">
                <span className="text-muted-foreground">
                  {unallocated >= 0 ? "Sin asignar" : "Sobre-asignado"}
                </span>
                <span
                  className={cn(
                    "font-mono font-semibold tabular-nums",
                    unallocated < 0 && "text-rose-500",
                    isPrivacyMode && "privacy-blur"
                  )}
                >
                  {formatCompact(Math.abs(unallocated))}
                </span>
              </span>
            </div>

            {/* ¿Me alcanza? simulator */}
            {isCurrentMonth && (
              <div
                className={cn(
                  "mt-4 rounded-xl border p-3 transition-colors",
                  isSimulating
                    ? simVerdict?.tone === "rose"
                      ? "border-rose-500/30 bg-rose-500/[0.04]"
                      : simVerdict?.tone === "amber"
                      ? "border-amber-500/30 bg-amber-500/[0.04]"
                      : "border-emerald-500/30 bg-emerald-500/[0.04]"
                    : "border-border/40 bg-muted/20"
                )}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold whitespace-nowrap">
                    💭 ¿Me alcanza?
                  </span>
                  <div className="relative w-32">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                      $
                    </span>
                    <Input
                      value={
                        simAmount > 0
                          ? simAmount.toLocaleString("es-CL")
                          : ""
                      }
                      placeholder="80.000"
                      inputMode="numeric"
                      onChange={(e) =>
                        setSimInput(e.target.value.replace(/\D/g, ""))
                      }
                      className="pl-6 h-8 text-xs font-mono"
                    />
                  </div>
                  <Select value={simCategory} onValueChange={setSimCategory}>
                    <SelectTrigger className="h-8 w-[150px] rounded-lg text-xs">
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">General</span>
                      </SelectItem>
                      {expenseCategories.map((cat) => (
                        <SelectItem key={cat.name} value={cat.name}>
                          <span className="flex items-center gap-2">
                            <span className="text-sm leading-none">
                              {cat.icon || "🏷️"}
                            </span>
                            {cat.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isSimulating && (
                    <button
                      onClick={() => {
                        setSimInput("");
                        setSimCategory("none");
                      }}
                      className="p-1.5 rounded-md hover:bg-accent transition-colors"
                      aria-label="Limpiar simulación"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
                {simVerdict && (
                  <p
                    className={cn(
                      "mt-2 text-xs font-medium leading-snug",
                      simVerdict.tone === "rose" && "text-rose-500",
                      simVerdict.tone === "amber" && "text-amber-600 dark:text-amber-500",
                      simVerdict.tone === "emerald" && "text-emerald-600 dark:text-emerald-500",
                      isPrivacyMode && "privacy-blur"
                    )}
                  >
                    {simVerdict.text}
                  </p>
                )}
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* ─── Envelopes ──────────────────────────────────── */}
      <SectionCard
        title="Sobres por categoría"
        icon={Target}
        tooltip="Cada categoría con su límite mensual y cuánto puedes gastar por día en ella. Haz clic para ajustar."
        action={
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={openNewLimitDialog}
          >
            <Plus className="h-3 w-3" />
            Agregar
          </Button>
        }
      >
        {envelopes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {envelopes.map((cat) => {
              const catUsage = (cat.effectiveAmount / cat.limit!) * 100;
              const catRemaining = cat.limit! - cat.effectiveAmount;
              const catPerDay = catRemaining / daysLeft;
              const color = categoryColor(cat.category);
              const statusColor = cat.isOverLimit
                ? ROSE
                : cat.isNearLimit
                ? AMBER
                : color;
              const isSimTarget = isSimulating && simCategory === cat.category;

              return (
                <div
                  key={cat.category}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSetLimit(cat.category)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSetLimit(cat.category);
                    }
                  }}
                  className={cn(
                    "group relative rounded-xl border bg-card p-3 transition-all cursor-pointer native-press",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    isSimTarget
                      ? "border-amber-500/40 shadow-sm"
                      : "border-border/50 hover:border-primary/20 hover:shadow-sm"
                  )}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm leading-none shrink-0">
                        {categoryEmoji(cat.category)}
                      </span>
                      <span className="text-xs font-medium truncate">
                        {cat.category}
                      </span>
                      {isSimTarget && (
                        <span className={cn("text-[10px] font-mono font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-md shrink-0", isPrivacyMode && "privacy-blur")}>
                          +{formatCompact(simAmount)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                      <button
                        className="p-1 rounded hover:bg-accent transition-colors"
                        aria-label={`Quitar límite de ${cat.category}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLimit(cat.category);
                        }}
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>

                  {/* Envelope hero: what you can still spend per day */}
                  <div className="flex items-baseline justify-between mb-1">
                    <span
                      className={cn(
                        "text-base font-bold font-mono tabular-nums",
                        catRemaining < 0 && "text-rose-500",
                        isPrivacyMode && "privacy-blur"
                      )}
                    >
                      {isCurrentMonth
                        ? catRemaining >= 0
                          ? `${formatCurrency(Math.round(catPerDay))}`
                          : `−${formatCompact(Math.abs(catRemaining))}`
                        : catRemaining >= 0
                        ? formatCompact(catRemaining)
                        : `−${formatCompact(Math.abs(catRemaining))}`}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-mono tabular-nums font-semibold px-1.5 py-0.5 rounded-md",
                        cat.isOverLimit
                          ? "text-rose-500 bg-rose-500/10"
                          : cat.isNearLimit
                          ? "text-amber-500 bg-amber-500/10"
                          : "text-muted-foreground bg-muted/60"
                      )}
                    >
                      {catUsage.toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground -mt-0.5 mb-1.5">
                    {isCurrentMonth
                      ? catRemaining >= 0
                        ? "por día hasta fin de mes"
                        : "excedido"
                      : catRemaining >= 0
                      ? "sobró"
                      : "excedido"}
                  </p>

                  {/* Mini burn-down */}
                  <EnvelopeSparkline
                    txs={cat.transactions}
                    daysInMonth={daysInMonth}
                    endDay={todayDay}
                    limit={cat.limit!}
                    color={statusColor}
                  />

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-1.5 text-[10px]">
                    <span
                      className={cn(
                        "font-mono tabular-nums text-muted-foreground",
                        isPrivacyMode && "privacy-blur"
                      )}
                    >
                      {formatCompact(cat.effectiveAmount)} de{" "}
                      {formatCompact(cat.limit!)}
                    </span>
                    {cat.trend !== "stable" && cat.count > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              "flex items-center gap-0.5 font-medium tabular-nums",
                              cat.trend === "up"
                                ? "text-rose-500/70"
                                : "text-emerald-500/80"
                            )}
                          >
                            {cat.trend === "up" ? (
                              <TrendingUp className="h-2.5 w-2.5" />
                            ) : (
                              <TrendingDown className="h-2.5 w-2.5" />
                            )}
                            {Math.round(cat.trendPercentage)}%
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">
                            {cat.trend === "up" ? "Más" : "Menos"} gasto que el
                            mes pasado
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* Reimbursement */}
                  {cat.reimbursedAmount > 0 && (
                    <div className={cn("mt-2 text-[11px] text-emerald-600 dark:text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg", isPrivacyMode && "privacy-blur")}>
                      Reembolso: {formatCompact(cat.reimbursedAmount)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 rounded-full bg-primary/10 mb-3">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              No hay sobres todavía
            </p>
            <p className="text-xs text-muted-foreground/60 mb-3">
              Reparte tu presupuesto entre categorías y te digo cuánto puedes
              gastar por día en cada una
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-lg"
              onClick={openNewLimitDialog}
            >
              <Plus className="h-3 w-3" />
              Crear primer sobre
            </Button>
          </div>
        )}
      </SectionCard>

      {/* ─── Unbudgeted Categories ──────────────────────── */}
      {categoriesWithoutLimits.length > 0 && (
        <SectionCard
          title="Gastos sin sobre"
          tooltip="Categorías con gastos este mes pero sin límite definido. Haz clic para asignarles uno."
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {categoriesWithoutLimits.map((cat) => (
              <button
                key={cat.category}
                onClick={() => handleSetLimit(cat.category)}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-card hover:border-primary/20 hover:bg-accent/50 transition-all text-left group native-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <span className="text-base leading-none shrink-0">
                  {categoryEmoji(cat.category)}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium truncate block">
                    {cat.category}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] text-muted-foreground font-mono tabular-nums",
                      isPrivacyMode && "privacy-blur"
                    )}
                  >
                    {formatCompact(cat.effectiveAmount)}
                  </span>
                </div>
                <Plus className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ─── Evolution Chart ────────────────────────────── */}
      {comparisonChartData.length > 1 && availableChartCategories.length > 0 && (
        <SectionCard
          title="Evolución de Categorías"
          icon={BarChart3}
          tooltip={
            selectedChartCategories.size > 0
              ? `${selectedChartCategories.size} ${selectedChartCategories.size === 1 ? "categoría seleccionada" : "categorías seleccionadas"}`
              : "Top 5 categorías con mayor actividad en el período"
          }
          action={
            <div className="flex items-center gap-1.5">
              {/* Period selector */}
              <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5 border border-border/50">
                {[3, 6, 12].map((m) => (
                  <button
                    key={m}
                    onClick={() => setChartMonths(m)}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-xs font-medium transition-colors",
                      chartMonths === m
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m}M
                  </button>
                ))}
              </div>
              {/* Average toggle */}
              <button
                onClick={() => setShowAverage((v) => !v)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border",
                  showAverage
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-accent"
                )}
              >
                <span className="text-[10px]">∼</span>
                Promedio
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border",
                    selectedChartCategories.size > 0
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-accent"
                  )}>
                    <SlidersHorizontal className="h-3 w-3" />
                    {selectedChartCategories.size > 0
                      ? `${selectedChartCategories.size} seleccionada${selectedChartCategories.size > 1 ? "s" : ""}`
                      : "Top 5"}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" collisionPadding={8} className="w-52 p-2">
                  <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-border/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categorías</span>
                    {selectedChartCategories.size > 0 && (
                      <button
                        onClick={() => setSelectedChartCategories(new Set())}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-0.5">
                    {availableChartCategories.map((cat) => {
                      const checked = selectedChartCategories.has(cat);
                      return (
                        <label
                          key={cat}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setSelectedChartCategories((prev) => {
                                const next = new Set(prev);
                                if (v) next.add(cat);
                                else next.delete(cat);
                                return next;
                              });
                            }}
                          />
                          <span className="text-sm leading-none shrink-0">
                            {categoryEmoji(cat)}
                          </span>
                          <span className="text-xs text-foreground truncate">{cat}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          }
        >
          <div className={cn(isPrivacyMode && "privacy-blur")}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={comparisonChartData}>
                <XAxis
                  dataKey="month"
                  stroke={CHART_COLORS.mutedAxis}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={CHART_COLORS.mutedAxis}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompact(v)}
                  width={55}
                />
                <ChartTooltip content={<EvolutionTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                />
                {activeChartCategories.map((cat) => (
                  <Line
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    stroke={categoryLineColors[cat]}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
                {showAverage && activeChartCategories.map((cat) => (
                  <Line
                    key={`${cat}_avg`}
                    type="monotone"
                    dataKey={`${cat}_avg`}
                    stroke={categoryLineColors[cat]}
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={false}
                    legendType="none"
                    tooltipType="none"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}

      {/* ─── Set Limit Dialog ───────────────────────────── */}
      <Dialog open={isLimitDialogOpen} onOpenChange={setIsLimitDialogOpen}>
        <DialogContent className="p-8">
          <DialogHeader>
            <DialogTitle>
              {limitFormData.category
                ? `Configurar sobre de ${limitFormData.category}`
                : "Crear sobre para una categoría"}
            </DialogTitle>
            <DialogDescription>
              Define cuánto quieres destinar a esta categoría cada mes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!limitFormData.category && (
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select
                  value={limitFormData.category}
                  onValueChange={(value) =>
                    setLimitFormData({ ...limitFormData, category: value })
                  }
                >
                  <SelectTrigger className="h-10 rounded-lg px-6">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((cat) => (
                      <SelectItem key={cat.name} value={cat.name}>
                        <span className="flex items-center gap-2">
                          <span className="text-base leading-none">{cat.icon || "🏷️"}</span>
                          {cat.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="limit">Monto asignado</Label>
              <Input
                id="limit"
                type="text"
                placeholder="$500.000"
                value={
                  limitFormData.limit
                    ? `$${Number(limitFormData.limit).toLocaleString("es-CL")}`
                    : ""
                }
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  setLimitFormData({ ...limitFormData, limit: value });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && limitFormData.category && limitFormData.limit) {
                    handleSaveLimit();
                  }
                }}
                className="text-lg h-10 rounded-lg px-6"
                autoFocus
              />

              {/* Quick percentage buttons */}
              {totalBudget > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[5, 10, 15, 20, 25, 30].map((pct) => {
                    const amount = Math.round(totalBudget * pct / 100);
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() =>
                          setLimitFormData({ ...limitFormData, limit: amount.toString() })
                        }
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border",
                          Number(limitFormData.limit) === amount
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-accent hover:text-foreground"
                        )}
                      >
                        {pct}%
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Budget allocation context */}
            {totalBudget > 0 && (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
                {(() => {
                  const currentLimit = Number(limitFormData.limit) || 0;
                  const existingLimitForCategory = limits.find(
                    (l) => l.category_name === limitFormData.category
                  );
                  const otherAllocated = totalAllocated - (existingLimitForCategory?.monthly_limit || 0);
                  const newTotalAllocated = otherAllocated + currentLimit;
                  const newUnallocated = totalBudget - newTotalAllocated;
                  const pctOfBudget = totalBudget > 0 ? (currentLimit / totalBudget) * 100 : 0;

                  return (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Esto representa</span>
                        <span className="font-semibold font-mono tabular-nums">
                          {pctOfBudget.toFixed(0)}% del presupuesto
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Equivale por día</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(Math.round(currentLimit / daysInMonth))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Otras categorías</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(otherAllocated)}
                        </span>
                      </div>
                      <div className="h-px bg-border/50" />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">
                          {newUnallocated >= 0 ? "Sin asignar" : "Sobre-asignado"}
                        </span>
                        <span
                          className={cn(
                            "font-semibold font-mono tabular-nums",
                            newUnallocated < 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-500"
                          )}
                        >
                          {formatCurrency(Math.abs(newUnallocated))}
                        </span>
                      </div>
                      {/* Mini progress bar */}
                      <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            newUnallocated < 0 ? "bg-rose-500" : "bg-primary"
                          )}
                          style={{ width: `${Math.min((newTotalAllocated / totalBudget) * 100, 100)}%` }}
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsLimitDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveLimit}
              disabled={!limitFormData.category || !limitFormData.limit}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
