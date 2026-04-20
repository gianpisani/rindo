import { useState, useMemo } from "react";
import { GlassCard } from "./GlassCard";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
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
  Wallet,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  BarChart3,
  SlidersHorizontal,
} from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
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
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className="flex-1 p-6 pt-4">{children}</div>
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
  const [selectedChartCategories, setSelectedChartCategories] = useState<Set<string>>(new Set());
  const [chartMonths, setChartMonths] = useState(6);
  const [showAverage, setShowAverage] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [limitFormData, setLimitFormData] = useState({
    category: "",
    limit: "",
    alertPercentage: 80,
  });

  const { categorySpending, monthlyComparison, insights, totalSpending } =
    useCategoryInsights(transactions, limits, selectedMonth, chartMonths);

  // Budget management
  const totalAllocated = limits.reduce((s, l) => s + l.monthly_limit, 0);
  const totalBudget = budget?.total_budget || 0;
  const unallocated = totalBudget - totalAllocated;
  const usagePercent = totalBudget > 0 ? (totalSpending / totalBudget) * 100 : 0;
  const remaining = totalBudget - totalSpending;

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
      .map((c) => c.name)
      .sort();
  }, [categories]);

  const isCurrentMonth =
    format(selectedMonth, "yyyy-MM") === format(new Date(), "yyyy-MM");

  // Categories with/without limits
  const categoriesWithLimits = categorySpending.filter((c) => c.limit);
  const categoriesWithoutLimits = categorySpending.filter(
    (c) => !c.limit && c.count > 0
  );

  // Distribution bar segments
  const distributionSegments = useMemo(() => {
    if (!totalBudget) return [];
    return categoriesWithLimits.map((cat) => {
      const catObj = categories.find((c) => c.name === cat.category);
      return {
        category: cat.category,
        percentage: (cat.limit! / totalBudget) * 100,
        color: catObj?.color || "#6b7280",
      };
    });
  }, [totalBudget, categoriesWithLimits, categories]);

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

  // Insights
  const alertInsights = insights.filter((i) => i.type === "alert");
  const achievementInsights = insights.filter((i) => i.type === "achievement");
  const patternInsights = insights.filter(
    (i) => i.type === "pattern" || i.type === "opportunity"
  );

  // Month navigation
  const changeMonth = (delta: number) => {
    setSelectedMonth((prev) =>
      delta > 0 ? addMonths(prev, 1) : subMonths(prev, 1)
    );
  };

  // Category colors for chart lines
  const categoryLineColors = useMemo(() => {
    const colors: Record<string, string> = {};
    availableChartCategories.forEach((cat) => {
      const catObj = categories.find((c) => c.name === cat);
      colors[cat] = catObj?.color || `hsl(${Math.random() * 360}, 70%, 50%)`;
    });
    return colors;
  }, [availableChartCategories, categories]);

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">
            Presupuesto
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Cargando..."
              : totalBudget > 0
              ? `${formatCurrency(totalSpending)} gastado de ${formatCurrency(totalBudget)}`
              : "Define tu presupuesto mensual y distribúyelo por categoría"}
          </p>
        </div>

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

      {/* ─── KPI Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Budget */}
        <GlassCard className="relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent" />
          <div className="relative p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Target className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Presupuesto
              </span>
              {!editingBudget && (
                <button
                  onClick={startEditBudget}
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
            {editingBudget ? (
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    $
                  </span>
                  <Input
                    value={
                      budgetInput
                        ? parseInt(
                            budgetInput.replace(/\D/g, ""),
                            10
                          ).toLocaleString("es-CL")
                        : ""
                    }
                    onChange={(e) =>
                      setBudgetInput(e.target.value.replace(/\D/g, ""))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveBudget();
                      if (e.key === "Escape") setEditingBudget(false);
                    }}
                    className="pl-6 text-base font-bold font-mono h-8"
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
              <div
                className={cn(
                  "text-2xl font-bold font-mono tabular-nums",
                  isPrivacyMode && "privacy-blur"
                )}
              >
                {totalBudget > 0 ? (
                  <button
                    onClick={startEditBudget}
                    className="hover:text-primary/80 transition-colors cursor-pointer"
                  >
                    $
                    <NumberFlow
                      value={totalBudget}
                      format={{
                        style: "decimal",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }}
                      locales="es-CL"
                    />
                  </button>
                ) : (
                  <button
                    onClick={startEditBudget}
                    className="text-base text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Definir →
                  </button>
                )}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Spent */}
        <GlassCard className="relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/[0.03] to-transparent" />
          <div className="relative p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-rose-500/10">
                <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Gastado
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
                value={totalSpending}
                format={{
                  style: "decimal",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }}
                locales="es-CL"
              />
            </div>
            {totalBudget > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {usagePercent.toFixed(0)}% del presupuesto
              </p>
            )}
          </div>
        </GlassCard>

        {/* Remaining */}
        <GlassCard className="relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200">
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-br to-transparent",
              remaining >= 0
                ? "from-emerald-500/[0.03]"
                : "from-rose-500/[0.03]"
            )}
          />
          <div className="relative p-5">
            <div className="flex items-center gap-2 mb-3">
              <div
                className={cn(
                  "p-1.5 rounded-lg",
                  remaining >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"
                )}
              >
                <Wallet
                  className={cn(
                    "h-3.5 w-3.5",
                    remaining >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {remaining >= 0 ? "Restante" : "Excedido"}
              </span>
            </div>
            <div
              className={cn(
                "text-2xl font-bold font-mono tabular-nums",
                remaining >= 0 ? "" : "text-rose-500",
                isPrivacyMode && "privacy-blur"
              )}
            >
              $
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
            {totalBudget > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {remaining >= 0
                  ? `${(100 - usagePercent).toFixed(0)}% disponible`
                  : `${(usagePercent - 100).toFixed(0)}% sobre el límite`}
              </p>
            )}
          </div>
        </GlassCard>

        {/* Allocated */}
        <GlassCard className="relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-500/[0.03] to-transparent" />
          <div className="relative p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-sky-500/10">
                <BarChart3 className="h-3.5 w-3.5 text-sky-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Asignado
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
                value={totalAllocated}
                format={{
                  style: "decimal",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }}
                locales="es-CL"
              />
            </div>
            {totalBudget > 0 && (
              <p
                className={cn(
                  "mt-2 text-xs",
                  unallocated < 0
                    ? "text-rose-500"
                    : "text-muted-foreground"
                )}
              >
                {unallocated >= 0
                  ? `${formatCompact(unallocated)} sin asignar`
                  : `${formatCompact(Math.abs(unallocated))} sobre-asignado`}
              </p>
            )}
          </div>
        </GlassCard>
      </div>

      {/* ─── Distribution Bar ───────────────────────────── */}
      {totalBudget > 0 && distributionSegments.length > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-4">
          <div className="space-y-3">
            <div className="h-3 rounded-full overflow-hidden bg-muted/60 flex">
              {distributionSegments.map((seg) => (
                <Tooltip key={seg.category}>
                  <TooltipTrigger asChild>
                    <div
                      className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full hover:opacity-80 cursor-default"
                      style={{
                        width: `${Math.min(seg.percentage, 100)}%`,
                        backgroundColor: seg.color,
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs font-medium">
                      {seg.category}: {seg.percentage.toFixed(0)}%
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
              {unallocated > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="h-full bg-muted-foreground/10"
                      style={{
                        width: `${(unallocated / totalBudget) * 100}%`,
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs font-medium">
                      Sin asignar: {formatCompact(unallocated)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {distributionSegments.map((seg) => (
                <div
                  key={seg.category}
                  className="flex items-center gap-1.5"
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {seg.category}
                  </span>
                  <span className="text-xs font-semibold tabular-nums">
                    {seg.percentage.toFixed(0)}%
                  </span>
                </div>
              ))}
              {unallocated > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full shrink-0 bg-muted-foreground/20" />
                  <span className="text-xs text-muted-foreground">
                    Sin asignar
                  </span>
                  <span className="text-xs font-semibold tabular-nums">
                    {((unallocated / totalBudget) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Category Grid + Insights ───────────────────── */}
      <div
        className={cn(
          "grid grid-cols-1 gap-6",
          insights.length > 0 && "lg:grid-cols-12"
        )}
      >
        {/* Categories with budgets */}
        <div className={cn(insights.length > 0 ? "lg:col-span-8" : "")}>
          <SectionCard
            title="Categorías con presupuesto"
            icon={Target}
            tooltip="Categorías con límite mensual asignado"
            action={
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => {
                  setLimitFormData({
                    category: "",
                    limit: "",
                    alertPercentage: 80,
                  });
                  setIsLimitDialogOpen(true);
                }}
              >
                <Plus className="h-3 w-3" />
                Agregar
              </Button>
            }
          >
            {categoriesWithLimits.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categoriesWithLimits.map((cat) => {
                  const catUsage = cat.limit
                    ? (cat.effectiveAmount / cat.limit) * 100
                    : 0;
                  const catRemaining = (cat.limit || 0) - cat.effectiveAmount;
                  const catObj = categories.find(
                    (c) => c.name === cat.category
                  );
                  const color = catObj?.color || "#6b7280";

                  return (
                    <div
                      key={cat.category}
                      className="group relative rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-primary/20 hover:shadow-sm cursor-pointer"
                      onClick={() => handleSetLimit(cat.category)}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base leading-none shrink-0">
                            {catObj?.icon || "🏷️"}
                          </span>
                          <span className="text-sm font-medium truncate">
                            {cat.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                          <button
                            className="p-1 rounded hover:bg-accent transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLimit(cat.category);
                            }}
                          >
                            <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="flex items-baseline justify-between mb-2">
                        <span
                          className={cn(
                            "text-lg font-bold font-mono tabular-nums",
                            isPrivacyMode && "privacy-blur"
                          )}
                        >
                          {formatCurrency(cat.effectiveAmount)}
                        </span>
                        <span
                          className={cn(
                            "text-xs text-muted-foreground font-mono tabular-nums",
                            isPrivacyMode && "privacy-blur"
                          )}
                        >
                          de {formatCompact(cat.limit!)}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 rounded-full bg-muted/60 overflow-hidden mb-2">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(catUsage, 100)}%`,
                            backgroundColor: cat.isOverLimit
                              ? "#e11d48"
                              : cat.isNearLimit
                              ? "#f59e0b"
                              : color,
                          }}
                        />
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={cn(
                            "font-semibold font-mono tabular-nums",
                            catRemaining < 0
                              ? "text-rose-500"
                              : "text-emerald-600",
                            isPrivacyMode && "privacy-blur"
                          )}
                        >
                          {catRemaining >= 0
                            ? `${formatCompact(catRemaining)} restante`
                            : `${formatCompact(Math.abs(catRemaining))} excedido`}
                        </span>
                        <span
                          className={cn(
                            "font-mono tabular-nums font-semibold px-1.5 py-0.5 rounded-md",
                            cat.isOverLimit
                              ? "text-rose-600 bg-rose-500/10"
                              : cat.isNearLimit
                              ? "text-amber-600 bg-amber-500/10"
                              : "text-muted-foreground bg-muted/60"
                          )}
                        >
                          {catUsage.toFixed(0)}%
                        </span>
                      </div>

                      {/* Reimbursement */}
                      {cat.reimbursedAmount > 0 && (
                        <div className="mt-2 text-[11px] text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-lg">
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
                  Asigna límites para controlar tus gastos
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-lg"
                  onClick={() => {
                    setLimitFormData({
                      category: "",
                      limit: "",
                      alertPercentage: 80,
                    });
                    setIsLimitDialogOpen(true);
                  }}
                >
                  <Plus className="h-3 w-3" />
                  Asignar primera categoría
                </Button>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="lg:col-span-4">
            <SectionCard
              title="Insights"
              icon={Lightbulb}
              tooltip="Alertas y patrones detectados en tus gastos"
            >
              <div className="space-y-3">
                {/* Alerts */}
                {alertInsights.map((insight, idx) => (
                  <div
                    key={`alert-${idx}`}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-rose-500/5 border border-rose-500/20"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-rose-600">
                        {insight.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {insight.description}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Achievements */}
                {achievementInsights.slice(0, 3).map((insight, idx) => (
                  <div
                    key={`ach-${idx}`}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20"
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-emerald-600">
                        {insight.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {insight.description}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Patterns */}
                {patternInsights.slice(0, 2).map((insight, idx) => (
                  <div
                    key={`pat-${idx}`}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20"
                  >
                    <TrendingUp className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-amber-600">
                        {insight.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {insight.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}
      </div>

      {/* ─── Unbudgeted Categories ──────────────────────── */}
      {categoriesWithoutLimits.length > 0 && (
        <SectionCard
          title="Sin presupuesto asignado"
          tooltip="Categorías con gastos este mes pero sin límite definido. Haz clic para asignar un presupuesto."
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {categoriesWithoutLimits.map((cat) => {
              const catObj = categories.find((c) => c.name === cat.category);
              const color = catObj?.color || "#6b7280";
              return (
                <button
                  key={cat.category}
                  onClick={() => handleSetLimit(cat.category)}
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-border/50 bg-card hover:border-primary/20 hover:bg-accent/50 transition-all text-left group"
                >
                  <span className="text-base leading-none shrink-0">
                    {catObj?.icon || "🏷️"}
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
              );
            })}
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
              : "Top 5 categorías con mayor actividad en los últimos 6 meses"
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
              <PopoverContent align="end" className="w-52 p-2">
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
                          {categories.find((c) => c.name === cat)?.icon || "🏷️"}
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
                      <SelectItem key={cat} value={cat}>
                        {cat}
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
                            newUnallocated < 0 ? "text-rose-500" : "text-emerald-600"
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
