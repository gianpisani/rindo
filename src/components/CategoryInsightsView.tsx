import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Alert, AlertDescription } from "./ui/alert";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { CategoryDetailModal } from "./CategoryDetailModal";
import { useCategoryInsights, CategorySpending } from "@/hooks/useCategoryInsights";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  Target,
  ChevronLeft,
  ChevronRight,
  Settings,
  Eye,
  Search,
  Plus,
  X,
  Info,
  Bell,
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
  DialogTrigger,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export function CategoryInsightsView() {
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const { limits, upsertLimit, deleteLimit } = useCategoryLimits();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState<CategorySpending | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "with-limit" | "no-limit">("all");
  const [isInsightsModalOpen, setIsInsightsModalOpen] = useState(false);
  const [limitFormData, setLimitFormData] = useState({
    category: "",
    limit: "",
    alertPercentage: 80,
  });

  const { categorySpending, monthlyComparison, insights, totalSpending } = useCategoryInsights(
    transactions,
    limits,
    selectedMonth
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      notation: "compact",
    }).format(value);
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(value);
  };

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "alert":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case "achievement":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "opportunity":
        return <Lightbulb className="h-5 w-5 text-yellow-500" />;
      default:
        return <Target className="h-5 w-5 text-blue-500" />;
    }
  };

  const handleCategoryClick = (category: CategorySpending) => {
    setSelectedCategory(category);
    setIsDetailModalOpen(true);
  };

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

  // Filter categories based on search and tab
  const filteredCategories = useMemo(() => {
    let filtered = categorySpending;

    // Filter by search
    if (searchQuery.trim()) {
      filtered = filtered.filter((cat) =>
        cat.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by tab
    if (activeTab === "with-limit") {
      filtered = filtered.filter((cat) => cat.limit !== undefined);
    } else if (activeTab === "no-limit") {
      filtered = filtered.filter((cat) => cat.limit === undefined);
    }

    return filtered;
  }, [categorySpending, searchQuery, activeTab]);

  // Get expense categories from categories list
  const expenseCategories = useMemo(() => {
    return categories
      .filter((c) => c.type === "Gasto")
      .map((c) => c.name)
      .sort();
  }, [categories]);

  const monthName = format(selectedMonth, "MMMM yyyy", { locale: es });

  // Prepare data for multi-month comparison chart - ALL categories
  const comparisonChartData = monthlyComparison.map((month) => {
    const data: Record<string, string | number> = { month: month.month };
    categorySpending.forEach((cat) => {
      data[cat.category] = month.categories[cat.category] || 0;
    });
    return data;
  });

  // Get top 5 categories for the chart (based on any activity in last 6 months)
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
      {/* Month Navigator */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
            <div>
              <CardTitle className="text-2xl capitalize">{monthName}</CardTitle>
              <CardDescription>Análisis detallado de gastos por categoría</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLimitFormData({ category: "", limit: "", alertPercentage: 80 });
                  setIsLimitDialogOpen(true);
                }}
                className="hidden md:flex"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar límite
              </Button>
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
                >
                  Hoy
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                  disabled={selectedMonth >= new Date()}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Total gastado</div>
              <div className="text-3xl font-bold">{formatCurrencyFull(totalSpending)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Categorías activas</div>
              <div className="text-3xl font-bold">{categorySpending.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Multi-Month Comparison Chart - First */}
      {comparisonChartData.length > 1 && top5Categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evolución de Categorías (últimos 6 meses)</CardTitle>
            <CardDescription>Top 5 categorías con más actividad</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={comparisonChartData}>
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrencyFull(value)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
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

      {/* Insights - Minimalist version in 2 columns */}
      {insights.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Alerts & Patterns */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4" />
                Alertas e Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {insights.slice(0, 4).map((insight, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                      insight.type === "alert"
                        ? "border-red-200 bg-red-50/50 dark:bg-red-950/10"
                        : insight.type === "achievement"
                        ? "border-green-200 bg-green-50/50 dark:bg-green-950/10"
                        : insight.type === "opportunity"
                        ? "border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/10"
                        : "border-blue-200 bg-blue-50/50 dark:bg-blue-950/10"
                    }`}
                    onClick={() => navigate("/category-insights")}
                  >
                    <div className="flex items-start gap-2">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{insight.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {insight.description}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {insights.length > 4 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setIsInsightsModalOpen(true)}
                  >
                    Ver todos ({insights.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Limits Summary */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4" />
                  Límites Configurados
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLimitFormData({ category: "", limit: "", alertPercentage: 80 });
                    setIsLimitDialogOpen(true);
                  }}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Agregar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {categorySpending.filter((c) => c.limit).length > 0 ? (
                <div className="space-y-2">
                  {categorySpending
                    .filter((c) => c.limit)
                    .slice(0, 4)
                    .map((cat) => {
                      const usagePercentage = cat.limit
                        ? (cat.amount / cat.limit) * 100
                        : 0;
                      return (
                        <div
                          key={cat.category}
                          className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleCategoryClick(cat)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold">{cat.category}</span>
                            <span
                              className={`text-xs font-bold ${
                                cat.isOverLimit
                                  ? "text-red-600"
                                  : cat.isNearLimit
                                  ? "text-yellow-600"
                                  : "text-green-600"
                              }`}
                            >
                              {usagePercentage.toFixed(0)}%
                            </span>
                          </div>
                          <Progress
                            value={Math.min(usagePercentage, 100)}
                            className={`h-1.5 ${
                              cat.isOverLimit
                                ? "[&>div]:bg-red-500 "
                                : cat.isNearLimit
                                ? "[&>div]:bg-yellow-500"
                                : "[&>div]:bg-green-500"
                            }`}
                          />
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(cat.amount)} / {formatCurrency(cat.limit!)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  {categorySpending.filter((c) => c.limit).length > 4 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        setActiveTab("with-limit");
                        navigate("/category-insights");
                      }}
                    >
                      Ver todos ({categorySpending.filter((c) => c.limit).length})
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No hay límites configurados</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setLimitFormData({ category: "", limit: "", alertPercentage: 80 });
                      setIsLimitDialogOpen(true);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    Configurar primer límite
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar categoría..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full md:w-auto">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">Todas ({categorySpending.length})</TabsTrigger>
                <TabsTrigger value="with-limit">
                  Con límite ({categorySpending.filter((c) => c.limit).length})
                </TabsTrigger>
                <TabsTrigger value="no-limit">
                  Sin límite ({categorySpending.filter((c) => !c.limit).length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {filteredCategories.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery
                  ? `No se encontraron categorías con "${searchQuery}"`
                  : "No hay categorías en este filtro"}
              </p>
              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="mt-4"
                >
                  Limpiar búsqueda
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories List */}
      <div className="grid gap-4">
        {filteredCategories.map((spending) => {
          const usagePercentage = spending.limit
            ? (spending.amount / spending.limit) * 100
            : 0;
          const hasSpending = spending.count > 0;

          return (
            <Card key={spending.category} className={`hover:shadow-lg transition-shadow ${!hasSpending && 'opacity-75'}`}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{spending.category}</h3>
                        {hasSpending && getTrendIcon(spending.trend)}
                        {hasSpending && spending.trend !== "stable" && (
                          <Badge variant="outline" className="text-xs">
                            {spending.trend === "up" ? "+" : "-"}
                            {spending.trendPercentage.toFixed(0)}% vs mes anterior
                          </Badge>
                        )}
                        {!hasSpending && (
                          <Badge variant="outline" className="text-xs">
                            Sin actividad este mes
                          </Badge>
                        )}
                      </div>
                      {hasSpending && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {spending.count} transacciones • Promedio{" "}
                          {formatCurrency(spending.amount / spending.count)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${!hasSpending && 'text-muted-foreground'}`}>
                        {formatCurrencyFull(spending.amount)}
                      </div>
                      {hasSpending && (
                        <div className="text-sm text-muted-foreground">
                          {spending.percentage.toFixed(1)}% del total
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar if limit exists */}
                  {spending.limit && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Límite: {formatCurrencyFull(spending.limit)}
                        </span>
                        <span
                          className={
                            spending.isOverLimit
                              ? "text-red-600 font-semibold"
                              : spending.isNearLimit
                              ? "text-yellow-600 font-semibold"
                              : "text-green-600"
                          }
                        >
                          {usagePercentage.toFixed(0)}%
                        </span>
                      </div>
                      <Progress
                        value={Math.min(usagePercentage, 100)}
                        className={
                          spending.isOverLimit
                            ? "[&>div]:bg-red-500"
                            : spending.isNearLimit
                            ? "[&>div]:bg-yellow-500"
                            : "[&>div]:bg-green-500"
                        }
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {spending.count > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCategoryClick(spending)}
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalles
                      </Button>
                    ) : (
                      <div className="flex-1 text-sm text-muted-foreground py-2 px-3 bg-muted/50 rounded-md text-center">
                        Sin transacciones este mes
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetLimit(spending.category)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      {spending.limit ? "Ajustar" : "Definir"} límite
                    </Button>
                    {spending.limit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteLimit(spending.category)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Category Detail Modal */}
      <CategoryDetailModal
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        category={selectedCategory}
        monthName={monthName}
      />

      {/* All Insights Modal */}
      <Dialog open={isInsightsModalOpen} onOpenChange={setIsInsightsModalOpen}>
        <DialogContent className="p-8 overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Todos los Insights de {monthName}
            </DialogTitle>
            <DialogDescription>
              Análisis completo de patrones y recomendaciones para tus gastos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {insights.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay insights disponibles este mes</p>
                <p className="text-sm mt-2">Agrega más transacciones para ver análisis</p>
              </div>
            ) : (
              insights.map((insight, idx) => (
                <Alert
                  key={idx}
                  className={`${
                    insight.type === "alert"
                      ? "border-red-200 bg-red-50 dark:bg-red-950/20"
                      : insight.type === "achievement"
                      ? "border-green-200 bg-green-50 dark:bg-green-950/20"
                      : insight.type === "opportunity"
                      ? "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20"
                      : "border-blue-200 bg-blue-50 dark:bg-blue-950/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {getInsightIcon(insight.type)}
                    <AlertDescription className="flex-1">
                      <div className="font-semibold text-base mb-1">{insight.title}</div>
                      <div className="text-sm">{insight.description}</div>
                      {insight.category && (
                        <div className="mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const cat = categorySpending.find((c) => c.category === insight.category);
                              if (cat) {
                                setSelectedCategory(cat);
                                setIsDetailModalOpen(true);
                                setIsInsightsModalOpen(false);
                              }
                            }}
                          >
                            Ver detalles de {insight.category}
                          </Button>
                        </div>
                      )}
                    </AlertDescription>
                  </div>
                </Alert>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInsightsModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Limit Dialog */}
      <Dialog open={isLimitDialogOpen} onOpenChange={setIsLimitDialogOpen}>
        <DialogContent className="p-8">
          <DialogHeader>
            <DialogTitle>
              {limitFormData.category
                ? `Configurar límite para ${limitFormData.category}`
                : "Configurar límite de categoría"}
            </DialogTitle>
            <DialogDescription>
              Define un presupuesto mensual y recibe alertas cuando te acerques al límite
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
              <Label htmlFor="limit">Límite mensual</Label>
              <Input
                id="limit"
                type="text"
                placeholder="$500.000"
                value={limitFormData.limit ? `$${Number(limitFormData.limit).toLocaleString("es-CL")}` : ""}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  setLimitFormData({ ...limitFormData, limit: value });
                }}
                className="text-lg h-10 rounded-lg px-6"
              />
              <p className="text-xs text-muted-foreground">
                Recibirás una alerta cuando alcances el {limitFormData.alertPercentage}% de este monto
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="alertPercentage" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Porcentaje de alerta
                </Label>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">
                    {limitFormData.alertPercentage}%
                  </div>
                  {limitFormData.limit && (
                    <div className="text-xs text-muted-foreground">
                      = {formatCurrency(Number(limitFormData.limit) * (limitFormData.alertPercentage / 100))}
                    </div>
                  )}
                </div>
              </div>
              <div className="relative">
                <input
                  id="alertPercentage"
                  type="range"
                  min="50"
                  max="100"
                  step="1"
                  value={limitFormData.alertPercentage}
                  onChange={(e) =>
                    setLimitFormData({
                      ...limitFormData,
                      alertPercentage: parseInt(e.target.value),
                    })
                  }
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer slider-primary"
                  style={{
                    background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((limitFormData.alertPercentage - 50) / 50) * 100}%, hsl(var(--muted)) ${((limitFormData.alertPercentage - 50) / 50) * 100}%, hsl(var(--muted)) 100%)`
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>50%</span>
                <span>100%</span>
              </div>
              {limitFormData.limit && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                  <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    Te avisaremos cuando gastes{" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(Number(limitFormData.limit) * (limitFormData.alertPercentage / 100))}
                    </span>
                    {" "}(te quedarían{" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(Number(limitFormData.limit) * ((100 - limitFormData.alertPercentage) / 100))}
                    </span>
                    {" "}para el resto del mes)
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLimitDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveLimit} disabled={!limitFormData.category || !limitFormData.limit}>
              Guardar límite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
