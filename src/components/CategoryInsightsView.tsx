import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useCategoryInsights } from "@/hooks/useCategoryInsights";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { useMonthlyBudget } from "@/hooks/useMonthlyBudget";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import {
  Target,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Pencil,
  Check,
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
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CHART_COLORS } from "@/lib/chart-config";

export function CategoryInsightsView() {
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const { limits, upsertLimit, deleteLimit } = useCategoryLimits();
  const { budget, upsertBudget } = useMonthlyBudget();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [limitFormData, setLimitFormData] = useState({
    category: "",
    limit: "",
    alertPercentage: 80,
  });

  const { categorySpending, monthlyComparison, totalSpending } = useCategoryInsights(
    transactions,
    limits,
    selectedMonth
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      notation: "compact",
    }).format(value);

  const formatCurrencyFull = (value: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(value);

  // Budget management
  const totalAllocated = limits.reduce((s, l) => s + l.monthly_limit, 0);
  const unallocated = (budget?.total_budget || 0) - totalAllocated;

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

  const monthName = format(selectedMonth, "MMMM yyyy", { locale: es });
  const isCurrentMonth = format(selectedMonth, "yyyy-MM") === format(new Date(), "yyyy-MM");

  // Categories with limits (for the grid)
  const categoriesWithLimits = categorySpending.filter((c) => c.limit);
  const categoriesWithoutLimits = categorySpending.filter((c) => !c.limit && c.count > 0);

  // Distribution bar segments
  const distributionSegments = useMemo(() => {
    if (!budget?.total_budget) return [];
    const total = budget.total_budget;
    return categoriesWithLimits.map((cat) => {
      const catObj = categories.find((c) => c.name === cat.category);
      return {
        category: cat.category,
        percentage: (cat.limit! / total) * 100,
        color: catObj?.color || "#6b7280",
      };
    });
  }, [budget, categoriesWithLimits, categories]);

  // Chart data
  const comparisonChartData = monthlyComparison.map((month) => {
    const data: Record<string, string | number> = { month: month.month };
    categorySpending.forEach((cat) => {
      data[cat.category] = month.categories[cat.category] || 0;
    });
    return data;
  });

  const top5Categories = useMemo(() => {
    const categorySums = categorySpending.map((cat) => {
      const total = monthlyComparison.reduce((sum, month) => {
        return sum + (month.categories[cat.category] || 0);
      }, 0);
      return { category: cat.category, total };
    });
    return categorySums
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((c) => c.category);
  }, [categorySpending, monthlyComparison]);

  return (
    <div className="space-y-6">
      {/* ─── Section 1: Budget Header ─────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Presupuesto
              </CardTitle>
              <CardDescription>
                Define tu presupuesto mensual y distribúyelo por categoría
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 ml-auto md:ml-0">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedMonth(new Date())}
                className="min-w-[140px] capitalize"
              >
                {monthName}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                disabled={isCurrentMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Budget Total */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-sm text-muted-foreground mb-1">
                Presupuesto total mensual
              </div>
              {editingBudget ? (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 max-w-[240px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
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
                      className="pl-7 text-lg font-bold font-mono h-10"
                      autoFocus
                    />
                  </div>
                  <Button size="icon" variant="ghost" onClick={handleSaveBudget}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingBudget(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold font-mono tabular-nums">
                    {budget?.total_budget
                      ? formatCurrencyFull(budget.total_budget)
                      : "Sin definir"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={startEditBudget}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Distribution bar */}
          {budget?.total_budget && budget.total_budget > 0 && (
            <div className="space-y-2">
              <div className="h-3 rounded-full overflow-hidden bg-muted/60 flex">
                {distributionSegments.map((seg) => (
                  <div
                    key={seg.category}
                    className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
                    style={{
                      width: `${Math.min(seg.percentage, 100)}%`,
                      backgroundColor: seg.color,
                    }}
                    title={`${seg.category}: ${seg.percentage.toFixed(0)}%`}
                  />
                ))}
                {unallocated > 0 && (
                  <div
                    className="h-full bg-muted-foreground/10"
                    style={{
                      width: `${(unallocated / budget.total_budget) * 100}%`,
                    }}
                    title={`Sin asignar: ${formatCurrency(unallocated)}`}
                  />
                )}
              </div>
              {/* Stats row */}
              <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <div>
                  Asignado:{" "}
                  <span className="font-semibold text-foreground font-mono tabular-nums">
                    {formatCurrency(totalAllocated)}
                  </span>
                </div>
                <div>
                  Sin asignar:{" "}
                  <span
                    className={`font-semibold font-mono tabular-nums ${
                      unallocated < 0 ? "text-rose-500" : "text-foreground"
                    }`}
                  >
                    {formatCurrency(Math.max(0, unallocated))}
                  </span>
                </div>
                <div>
                  Gastado este mes:{" "}
                  <span className="font-semibold text-foreground font-mono tabular-nums">
                    {formatCurrency(totalSpending)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Section 2: Category Grid ─────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Categorías con presupuesto
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLimitFormData({
                category: "",
                limit: "",
                alertPercentage: 80,
              });
              setIsLimitDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar categoría
          </Button>
        </div>

        {categoriesWithLimits.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoriesWithLimits.map((cat) => {
              const usagePercentage = cat.limit
                ? (cat.effectiveAmount / cat.limit) * 100
                : 0;
              const remaining = (cat.limit || 0) - cat.effectiveAmount;
              const catObj = categories.find((c) => c.name === cat.category);
              const color = catObj?.color || "#6b7280";

              return (
                <Card
                  key={cat.category}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="pt-5 pb-4 space-y-3">
                    {/* Name + color */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-sm font-semibold">{cat.category}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleSetLimit(cat.category)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteLimit(cat.category)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Amount + limit */}
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-bold font-mono tabular-nums">
                        {formatCurrencyFull(cat.effectiveAmount)}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono tabular-nums">
                        de {formatCurrency(cat.limit!)}
                      </span>
                    </div>

                    {/* Progress */}
                    <Progress
                      value={Math.min(usagePercentage, 100)}
                      className={`h-2 ${
                        cat.isOverLimit
                          ? "[&>div]:bg-destructive"
                          : cat.isNearLimit
                          ? "[&>div]:bg-amber-500"
                          : "[&>div]:bg-emerald-500"
                      }`}
                    />

                    {/* Remaining */}
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`font-semibold font-mono tabular-nums ${
                          remaining < 0 ? "text-rose-500" : "text-emerald-600"
                        }`}
                      >
                        {remaining >= 0
                          ? `${formatCurrency(remaining)} restante`
                          : `${formatCurrency(Math.abs(remaining))} excedido`}
                      </span>
                      <span
                        className={`font-mono tabular-nums ${
                          cat.isOverLimit
                            ? "text-rose-500"
                            : cat.isNearLimit
                            ? "text-amber-500"
                            : "text-muted-foreground"
                        }`}
                      >
                        {usagePercentage.toFixed(0)}%
                      </span>
                    </div>

                    {/* Reimbursement info */}
                    {cat.reimbursedAmount > 0 && (
                      <div className="text-[11px] text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded">
                        Reembolso aplicado: {formatCurrency(cat.reimbursedAmount)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-sm text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No hay categorías con presupuesto asignado</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setLimitFormData({
                      category: "",
                      limit: "",
                      alertPercentage: 80,
                    });
                    setIsLimitDialogOpen(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-2" />
                  Asignar primera categoría
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Categories without limits (if they have spending) */}
        {categoriesWithoutLimits.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Sin presupuesto asignado
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {categoriesWithoutLimits.map((cat) => {
                const catObj = categories.find((c) => c.name === cat.category);
                const color = catObj?.color || "#6b7280";
                return (
                  <button
                    key={cat.category}
                    onClick={() => handleSetLimit(cat.category)}
                    className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium truncate block">
                        {cat.category}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                        {formatCurrency(cat.effectiveAmount)}
                      </span>
                    </div>
                    <Plus className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── Section 3: Evolution Chart ───────────────────── */}
      {comparisonChartData.length > 1 && top5Categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evolución de Categorías (últimos 6 meses)</CardTitle>
            <CardDescription>Top 5 categorías con más actividad</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={comparisonChartData}>
                <XAxis dataKey="month" stroke={CHART_COLORS.mutedAxis} fontSize={12} />
                <YAxis
                  stroke={CHART_COLORS.mutedAxis}
                  fontSize={12}
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrencyFull(value)}
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.98)",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    padding: "12px",
                  }}
                  labelStyle={{
                    color: "#0f172a",
                    fontWeight: 600,
                  }}
                  itemStyle={{
                    fontWeight: 600,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                {top5Categories.map((cat, idx) => (
                  <Line
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    stroke={`hsl(${(idx * 70) % 360}, 70%, 50%)`}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ─── Set Limit Dialog ─────────────────────────────── */}
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
                className="text-lg h-10 rounded-lg px-6"
                autoFocus
              />
            </div>
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
