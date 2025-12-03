import { BaseModal } from "./BaseModal";
import { CategorySpending } from "@/hooks/useCategoryInsights";
import { Badge } from "./ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Calendar, Receipt, DollarSign, Hash, CheckCircle, Lightbulb } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { Alert, AlertDescription } from "./ui/alert";

interface CategoryDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategorySpending | null;
  monthName: string;
}

export function CategoryDetailModal({
  open,
  onOpenChange,
  category,
  monthName,
}: CategoryDetailModalProps) {
  if (!category) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(value);
  };

  const getTrendIcon = () => {
    switch (category.trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendColor = () => {
    switch (category.trend) {
      case "up":
        return "text-red-500";
      case "down":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };

  const hasTransactions = category.count > 0;

  // Group transactions by date
  const transactionsByDate = category.transactions.reduce((acc, t) => {
    const date = format(new Date(t.date), "dd MMM yyyy", { locale: es });
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(t);
    return acc;
  }, {} as Record<string, typeof category.transactions>);

  // Sort dates descending
  const sortedDates = Object.keys(transactionsByDate).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  // Calculate day of week spending
  const dayOfWeekSpending = category.transactions.reduce((acc, t) => {
    const dayName = format(new Date(t.date), "EEEE", { locale: es });
    acc[dayName] = (acc[dayName] || 0) + Number(t.amount);
    return acc;
  }, {} as Record<string, number>);

  const dayOfWeekData = Object.entries(dayOfWeekSpending)
    .map(([day, amount]) => ({ day, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Calculate time of day distribution
  const timeOfDaySpending = category.transactions.reduce((acc, t) => {
    const hour = new Date(t.date).getHours();
    let timeSlot: string;
    if (hour >= 6 && hour < 12) {
      timeSlot = "Mañana (6-12)";
    } else if (hour >= 12 && hour < 18) {
      timeSlot = "Tarde (12-18)";
    } else if (hour >= 18 && hour < 24) {
      timeSlot = "Noche (18-24)";
    } else {
      timeSlot = "Madrugada (0-6)";
    }
    acc[timeSlot] = (acc[timeSlot] || 0) + Number(t.amount);
    return acc;
  }, {} as Record<string, number>);

  const timeOfDayData = Object.entries(timeOfDaySpending)
    .map(([time, amount]) => ({ time, amount }))
    .sort((a, b) => b.amount - a.amount);

  const averagePerTransaction = hasTransactions ? category.amount / category.count : 0;

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title={`${category.category} - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`} // Primer letra en mayúscula
      maxWidth="xl"
    >
      {!hasTransactions ? (
        <div className="space-y-6">
          <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-900 dark:text-yellow-100 flex items-center gap-2">
              <span>No hay transacciones en esta categoría para {monthName}</span>
            </AlertDescription>
          </Alert>
          
          {category.limit && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Límite configurado</h3>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{formatCurrency(category.limit)}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Alerta configurada al {category.alertPercentage}%
                </div>
              </div>
            </div>
          )}

          <div className="text-center py-8 text-muted-foreground">
            <p>Agrega transacciones en esta categoría para ver estadísticas detalladas</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Total
            </div>
            <div className="text-2xl font-bold">{formatCurrency(category.amount)}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Hash className="h-4 w-4" />
              Transacciones
            </div>
            <div className="text-2xl font-bold">{category.count}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Receipt className="h-4 w-4" />
              Promedio
            </div>
            <div className="text-2xl font-bold">{formatCurrency(averagePerTransaction)}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {getTrendIcon()}
              Tendencia
            </div>
            <div className={`text-2xl font-bold ${getTrendColor()}`}>
              {category.trend === "up" ? "+" : category.trend === "down" ? "-" : ""}
              {category.trendPercentage.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Limit Alert */}
        {category.limit && (
          <Alert className={`${category.isOverLimit ? "border-red-500 bg-red-50 dark:bg-red-950/20" : category.isNearLimit ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20" : "border-green-500 bg-green-50 dark:bg-green-950/20"}`}>
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {category.isOverLimit ? (
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  ) : category.isNearLimit ? (
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span className={`font-semibold ${category.isOverLimit ? "text-red-900 dark:text-red-100" : category.isNearLimit ? "text-yellow-900 dark:text-yellow-100" : "text-green-900 dark:text-green-100"}`}>
                    {category.isOverLimit
                      ? `Límite superado: ${formatCurrency(category.amount)} / ${formatCurrency(category.limit)}`
                      : category.isNearLimit
                      ? `Cerca del límite: ${formatCurrency(category.amount)} / ${formatCurrency(category.limit)}`
                      : `Dentro del presupuesto: ${formatCurrency(category.amount)} / ${formatCurrency(category.limit)}`}
                  </span>
                </div>
                <span className={`text-sm ${category.isOverLimit ? "text-red-700 dark:text-red-300" : category.isNearLimit ? "text-yellow-700 dark:text-yellow-300" : "text-green-700 dark:text-green-300"}`}>
                  {((category.amount / category.limit) * 100).toFixed(0)}%
                </span>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Insights Section */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Insights
          </h3>
          <div className="grid gap-2 text-sm">
            {dayOfWeekData.length > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <span className="font-medium">Días que más gastas: </span>
                <span className="text-muted-foreground">
                  {dayOfWeekData[0].day} ({formatCurrency(dayOfWeekData[0].amount)})
                  {dayOfWeekData[1] && ` y ${dayOfWeekData[1].day} (${formatCurrency(dayOfWeekData[1].amount)})`}
                </span>
              </div>
            )}
            {timeOfDayData.length > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <span className="font-medium">Horario peak: </span>
                <span className="text-muted-foreground">
                  {timeOfDayData[0].time} ({formatCurrency(timeOfDayData[0].amount)})
                </span>
              </div>
            )}
            <div className="p-3 bg-muted/50 rounded-lg">
              <span className="font-medium">Frecuencia: </span>
              <span className="text-muted-foreground">
                {category.count} veces este mes (promedio {formatCurrency(averagePerTransaction)} por transacción)
              </span>
            </div>
            {category.trend !== "stable" && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <span className="font-medium">Comparación: </span>
                <span className="text-muted-foreground">
                  {category.trend === "up" ? "Aumentó" : "Disminuyó"} {category.trendPercentage.toFixed(0)}% vs mes anterior
                </span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4">
          {dayOfWeekData.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Gastos por día de la semana</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dayOfWeekData}>
                  <XAxis dataKey="day" fontSize={10} />
                  <YAxis fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {timeOfDayData.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Gastos por horario</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={timeOfDayData}>
                  <XAxis dataKey="time" fontSize={10} />
                  <YAxis fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="amount" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <Separator />

        {/* Transactions List */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Desglose por fecha
          </h3>
          <ScrollArea className="h-[400px] rounded-lg border p-4">
            <div className="space-y-4">
              {sortedDates.map((date) => {
                const dayTransactions = transactionsByDate[date];
                const dayTotal = dayTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

                return (
                  <div key={date} className="space-y-2">
                    <div className="flex items-center justify-between sticky top-0 bg-muted/50 backdrop-blur py-2 border-b">
                      <span className="text-sm font-semibold">{date}</span>
                      <span className="text-sm font-bold">{formatCurrency(dayTotal)}</span>
                    </div>
                    <div className="space-y-2 pl-4">
                      {dayTransactions.map((t) => (
                        <div key={t.id} className="flex items-start justify-between text-sm py-2 border-b last:border-0">
                          <div className="flex-1">
                            <div className="font-medium">{t.detail || "Sin detalle"}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(t.date), "HH:mm", { locale: es })}
                            </div>
                          </div>
                          <div className="font-semibold">{formatCurrency(Number(t.amount))}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
      )}
    </BaseModal>
  );
}
