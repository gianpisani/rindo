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
import { useTransactions } from "@/hooks/useTransactions";
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
import { format, addMonths, subMonths, getDaysInMonth } from "date-fns";
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
  LineChart,
  Line,
  XAxis,
  YAxis,
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

// ─── Custom Chart Tooltip ────────────────────────────────

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
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [selectedChartCategories, setSelectedChartCategories] = useState<Set<string>>(new Set());
  const [chartMonths, setChartMonths] = useState(6);
  const [showAverage, setShowAverage] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [limitFormData, setLimitFormData] = useState({
    category: "",
    limit: "",
    alertPercentage: 80,
  });

  const { categorySpending, monthlyComparison, totalSpending } =
    useCategoryInsights(transactions, limits, selectedMonth, chartMonths);

  // Budget management
  const totalAllocated = limits.reduce((s, l) => s + l.monthly_limit, 0);
  const totalBudget = budget?.total_budget || 0;
  const unallocated = totalBudget - totalAllocated;
  const usagePercent = totalBudget > 0 ? (totalSpending / totalBudget) * 100 : 0;
  const remaining = totalBudget - totalSpending;

  const isCurrentMonth =
    format(selectedMonth, "yyyy-MM") === format(new Date(), "yyyy-MM");

  // Month pace: how far into the month we are (only meaningful for the current month)
  const elapsedFraction = useMemo(() => {
    const now = new Date();
    return Math.min(now.getDate() / getDaysInMonth(now), 1);
  }, []);
  const elapsedPercent = elapsedFraction * 100;

  // Projected month-end spending at the current pace
  const projectedSpending =
    isCurrentMonth && elapsedFraction > 0.08 && totalSpending > 0
      ? totalSpending / elapsedFraction
      : null;
  const projectionOnTrack =
    projectedSpending !== null && projectedSpending <= totalBudget;

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

  // Limit CRUD
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

  // Categories with limits, most pressured first
  const categoriesWithLimits = useMemo(() => {
    return categorySpending
      .filter((c) => c.limit)
      .sort((a, b) => {
        const usageA = a.effectiveAmount / a.limit!;
        const usageB = b.effectiveAmount / b.limit!;
        return usageB - usageA;
      });
  }, [categorySpending]);

  const categoriesWithoutLimits = categorySpending.filter(
    (c) => !c.limit && c.count > 0
  );

  // Hero runway: spending segments per category against the total budget.
  // When overspent, the scale grows so segments always fit the track.
  const runwayScale = Math.max(totalBudget, totalSpending);
  const runwaySegments = useMemo(() => {
    if (runwayScale <= 0) return [];
    return categorySpending
      .filter((c) => c.effectiveAmount > 0)
      .sort((a, b) => b.effectiveAmount - a.effectiveAmount)
      .map((c) => ({
        category: c.category,
        amount: c.effectiveAmount,
        width: (c.effectiveAmount / runwayScale) * 100,
        percentOfBudget:
          totalBudget > 0 ? (c.effectiveAmount / totalBudget) * 100 : 0,
        color: categoryColor(c.category),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySpending, runwayScale, totalBudget, categories]);

  const isOverBudget = totalBudget > 0 && totalSpending > totalBudget;
  const budgetMarkPercent = isOverBudget ? (totalBudget / runwayScale) * 100 : null;

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

  // Month navigation
  const changeMonth = (delta: number) => {
    setSelectedMonth((prev) =>
      delta > 0 ? addMonths(prev, 1) : subMonths(prev, 1)
    );
  };

  const remainingLabel =
    remaining >= 0
      ? isCurrentMonth
        ? "Disponible este mes"
        : "Sobró del presupuesto"
      : isCurrentMonth
      ? "Presupuesto excedido"
      : "Excedido ese mes";

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

      {/* ─── Hero: budget runway ────────────────────────── */}
      {isLoading ? (
        <GlassCard className="px-4 py-5 sm:px-6">
          <Skeleton className="h-3 w-32 mb-2" />
          <Skeleton className="h-9 w-48 mb-5" />
          <Skeleton className="h-3 w-full rounded-full mb-3" />
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
            <p className="text-xs text-muted-foreground mb-4 max-w-[280px]">
              Es el total que planeas gastar cada mes. Después lo repartes
              entre tus categorías.
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
            {/* Top row: remaining + editable budget */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {remainingLabel}
                </p>
                <div
                  className={cn(
                    "text-3xl sm:text-4xl font-bold font-mono tabular-nums tracking-tight leading-none",
                    remaining < 0 && "text-rose-500",
                    isPrivacyMode && "privacy-blur"
                  )}
                >
                  {remaining < 0 && "−"}$
                  <NumberFlow
                    value={Math.abs(remaining)}
                    format={{
                      style: "decimal",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }}
                    locales="es-CL"
                  />
                </div>
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

            {/* Runway bar */}
            <div className={cn("mt-5", isCurrentMonth ? "mb-5" : "mb-1")}>
              <div className="relative">
                <div className="h-3 rounded-full bg-muted/60 flex overflow-hidden">
                  {runwaySegments.map((seg) => (
                    <Tooltip key={seg.category}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "h-full transition-all duration-500 cursor-default",
                            hoveredCategory && hoveredCategory !== seg.category
                              ? "opacity-30"
                              : "opacity-100"
                          )}
                          style={{
                            width: `${seg.width}%`,
                            backgroundColor: seg.color,
                          }}
                          onMouseEnter={() => setHoveredCategory(seg.category)}
                          onMouseLeave={() => setHoveredCategory(null)}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs font-medium">
                          {categoryEmoji(seg.category)} {seg.category}
                          <span className="mx-1 text-muted-foreground">·</span>
                          {formatCompact(seg.amount)}
                          {totalBudget > 0 && (
                            <span className="text-muted-foreground">
                              {" "}
                              ({seg.percentOfBudget.toFixed(0)}%)
                            </span>
                          )}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>

                {/* Budget boundary when overspent */}
                {budgetMarkPercent !== null && (
                  <div
                    className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded-full bg-background"
                    style={{ left: `${budgetMarkPercent}%` }}
                  />
                )}

                {/* Today pace marker */}
                {isCurrentMonth && (
                  <>
                    <div
                      className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-foreground/60"
                      style={{ left: `${elapsedPercent}%` }}
                    />
                    <span
                      className="absolute top-full mt-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground -translate-x-1/2"
                      style={{
                        left: `${Math.min(Math.max(elapsedPercent, 3), 97)}%`,
                      }}
                    >
                      Hoy
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
              <span className="flex items-baseline gap-1.5">
                <span className="text-muted-foreground">Gastado</span>
                <span
                  className={cn(
                    "font-mono font-semibold tabular-nums",
                    isPrivacyMode && "privacy-blur"
                  )}
                >
                  {formatCompact(totalSpending)}
                </span>
                <span className="text-muted-foreground/60 tabular-nums">
                  {usagePercent.toFixed(0)}%
                </span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-muted-foreground">Asignado</span>
                <span
                  className={cn(
                    "font-mono font-semibold tabular-nums",
                    isPrivacyMode && "privacy-blur"
                  )}
                >
                  {formatCompact(totalAllocated)}
                </span>
              </span>
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

            {/* Pace projection */}
            {projectedSpending !== null && totalBudget > 0 && (
              <div className="mt-2.5 flex items-center gap-1.5 text-[11px]">
                <span
                  className={cn(
                    "size-1.5 rounded-full shrink-0",
                    projectionOnTrack ? "bg-emerald-500" : "bg-rose-500"
                  )}
                />
                <span className="text-muted-foreground">
                  A este ritmo:{" "}
                  <span
                    className={cn(
                      "font-mono font-semibold tabular-nums text-foreground",
                      isPrivacyMode && "privacy-blur"
                    )}
                  >
                    ~{formatCompact(projectedSpending)}
                  </span>{" "}
                  al cierre del mes
                  {projectionOnTrack ? (
                    " — dentro del presupuesto"
                  ) : (
                    <>
                      {" — "}
                      <span className={cn("text-rose-500 font-medium", isPrivacyMode && "privacy-blur")}>
                        {formatCompact(projectedSpending - totalBudget)} por sobre
                      </span>
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* ─── Categories with budget ─────────────────────── */}
      <SectionCard
        title="Categorías con presupuesto"
        icon={Target}
        tooltip="Cada categoría con su límite mensual. Haz clic en una para ajustarla."
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
        {categoriesWithLimits.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categoriesWithLimits.map((cat) => {
              const catUsage = cat.limit
                ? (cat.effectiveAmount / cat.limit) * 100
                : 0;
              const catRemaining = (cat.limit || 0) - cat.effectiveAmount;
              const color = categoryColor(cat.category);
              const isHighlighted = hoveredCategory === cat.category;

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
                  onMouseEnter={() => setHoveredCategory(cat.category)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className={cn(
                    "group relative rounded-xl border bg-card p-3 transition-all cursor-pointer native-press",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    isHighlighted
                      ? "border-primary/30 shadow-sm"
                      : "border-border/50 hover:border-primary/20 hover:shadow-sm"
                  )}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm leading-none shrink-0">
                        {categoryEmoji(cat.category)}
                      </span>
                      <span className="text-xs font-medium truncate">
                        {cat.category}
                      </span>
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

                  {/* Amounts */}
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="flex items-baseline gap-1">
                      <span
                        className={cn(
                          "text-base font-bold font-mono tabular-nums",
                          isPrivacyMode && "privacy-blur"
                        )}
                      >
                        {formatCompact(cat.effectiveAmount)}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] text-muted-foreground font-mono tabular-nums",
                          isPrivacyMode && "privacy-blur"
                        )}
                      >
                        de {formatCompact(cat.limit!)}
                      </span>
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

                  {/* Progress bar with pace tick */}
                  <div className="relative mb-1.5">
                    <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          cat.isOverLimit
                            ? "bg-rose-500"
                            : cat.isNearLimit
                            ? "bg-amber-500"
                            : ""
                        )}
                        style={{
                          width: `${Math.min(catUsage, 100)}%`,
                          backgroundColor:
                            cat.isOverLimit || cat.isNearLimit
                              ? undefined
                              : color,
                        }}
                      />
                    </div>
                    {isCurrentMonth && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-2.5 w-px bg-foreground/30"
                        style={{ left: `${elapsedPercent}%` }}
                      />
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={cn(
                        "font-semibold font-mono tabular-nums",
                        catRemaining < 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-500",
                        isPrivacyMode && "privacy-blur"
                      )}
                    >
                      {catRemaining >= 0
                        ? `${formatCompact(catRemaining)} restante`
                        : `${formatCompact(Math.abs(catRemaining))} excedido`}
                    </span>
                    {cat.trend !== "stable" && cat.count > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              "flex items-center gap-0.5 text-[10px] font-medium tabular-nums",
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
              No hay categorías con presupuesto
            </p>
            <p className="text-xs text-muted-foreground/60 mb-3">
              Reparte tu presupuesto entre categorías para controlar cada gasto
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-lg"
              onClick={openNewLimitDialog}
            >
              <Plus className="h-3 w-3" />
              Asignar primera categoría
            </Button>
          </div>
        )}
      </SectionCard>

      {/* ─── Unbudgeted Categories ──────────────────────── */}
      {categoriesWithoutLimits.length > 0 && (
        <SectionCard
          title="Gastos sin presupuesto"
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
                ? `Configurar presupuesto para ${limitFormData.category}`
                : "Asignar presupuesto a categoría"}
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
