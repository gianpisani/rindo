import Layout from "@/components/Layout";
import BalanceSummary from "@/components/BalanceSummary";
import ProjectionCard from "@/components/ProjectionCard";
import { NotificationSetup } from "@/components/NotificationSetup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";
import { useEmailTransactionNotifications } from "@/hooks/useEmailTransactionNotifications";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { es } from "date-fns/locale";

const COLORS = {
  Ingreso: "hsl(var(--chart-1))",
  Gasto: "hsl(var(--chart-2))",
  Inversión: "hsl(var(--chart-3))",
};

export default function Dashboard() {
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  
  // Sistema de notificaciones inteligentes
  useSmartNotifications(transactions);
  
  // Notificaciones automáticas de emails
  useEmailTransactionNotifications();

  // Monthly summary
  const last6Months = eachMonthOfInterval({
    start: subMonths(new Date(), 5),
    end: new Date(),
  });

  const monthlyData = last6Months.map((month) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    const monthTransactions = transactions.filter((t) => {
      const date = new Date(t.date);
      return date >= monthStart && date <= monthEnd;
    });

    const income = monthTransactions
      .filter((t) => t.type === "Ingreso")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenses = monthTransactions
      .filter((t) => t.type === "Gasto")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const investments = monthTransactions
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

  // Expenses by category
  const expensesByCategory = transactions
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
          color: category?.color || "#ef4444" // fallback a rojo si no hay color
        });
      }
      return acc;
    }, [] as { name: string; value: number; color: string }[])
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Type distribution with categories
  const typeWithCategories = transactions.reduce((acc, t) => {
    const existing = acc.find(
      (item) => item.category === t.category_name && item.type === t.type
    );
    if (existing) {
      existing.value += Number(t.amount);
    } else {
      const category = categories.find((c) => c.name === t.category_name);
      acc.push({
        category: t.category_name,
        type: t.type,
        value: Number(t.amount),
        color: category?.color || "#666666", // fallback gris si no hay color
      });
    }
    return acc;
  }, [] as { category: string; type: string; value: number; color: string }[]);

  // Prepare data for sunburst-style chart
  const chartData = typeWithCategories
    .filter((item) => item.value > 0)
    .sort((a, b) => {
      if (a.type !== b.type) {
        const typeOrder = { Ingreso: 0, Gasto: 1, Inversión: 2 };
        return typeOrder[a.type as keyof typeof typeOrder] - typeOrder[b.type as keyof typeof typeOrder];
      }
      return b.value - a.value;
    });

  // Calculate totals by type for insights
  const typeTotals = {
    Ingreso: chartData
      .filter((d) => d.type === "Ingreso")
      .reduce((sum, d) => sum + d.value, 0),
    Gasto: chartData
      .filter((d) => d.type === "Gasto")
      .reduce((sum, d) => sum + d.value, 0),
    Inversión: chartData
      .filter((d) => d.type === "Inversión")
      .reduce((sum, d) => sum + d.value, 0),
  };

  const totalAmount = typeTotals.Ingreso + typeTotals.Gasto + typeTotals.Inversión;

  // Get top categories
  const topCategoriesByType = {
    Ingreso: chartData
      .filter((d) => d.type === "Ingreso")
      .sort((a, b) => b.value - a.value)[0],
    Gasto: chartData
      .filter((d) => d.type === "Gasto")
      .sort((a, b) => b.value - a.value)[0],
    Inversión: chartData
      .filter((d) => d.type === "Inversión")
      .sort((a, b) => b.value - a.value)[0],
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      notation: "compact",
    }).format(value);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Resumen completo de tus finanzas
          </p>
        </div>

        <NotificationSetup />

        <BalanceSummary />
        
        <ProjectionCard />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-2xl shadow-elevated border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Evolución Mensual</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyData}>
                  <XAxis 
                    dataKey="month" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    tickFormatter={formatCurrency} 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "1rem",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: "12px" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Ingresos"
                    stroke={COLORS.Ingreso}
                    strokeWidth={3}
                    dot={{ fill: COLORS.Ingreso, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Gastos"
                    stroke={COLORS.Gasto}
                    strokeWidth={3}
                    dot={{ fill: COLORS.Gasto, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Inversiones"
                    stroke={COLORS.Inversión}
                    strokeWidth={3}
                    dot={{ fill: COLORS.Inversión, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-elevated border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">
                Distribución por Tipo y Categoría
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Análisis detallado de tus movimientos financieros
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Chart */}
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      {/* Outer ring - Categories */}
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={false}
                        outerRadius={120}
                        innerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        strokeWidth={2}
                        stroke="hsl(var(--card))"
                      >
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                          />
                        ))}
                      </Pie>
                      {/* Inner ring - Types */}
                      <Pie
                        data={[
                          { name: "Ingresos", value: typeTotals.Ingreso },
                          { name: "Gastos", value: typeTotals.Gasto },
                          { name: "Inversiones", value: typeTotals.Inversión },
                        ].filter((d) => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={75}
                        innerRadius={45}
                        fill="#8884d8"
                        dataKey="value"
                        strokeWidth={3}
                        stroke="hsl(var(--card))"
                      >
                        <Cell fill={COLORS.Ingreso} />
                        <Cell fill={COLORS.Gasto} />
                        <Cell fill={COLORS.Inversión} />
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string, props: { payload: { category?: string; type?: string } }) => [
                          formatCurrency(value),
                          props.payload.category || name
                        ]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "1rem",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Insights */}
                <div className="lg:w-64 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                      Principales Categorías
                    </h4>
                    <div className="space-y-3">
                      {topCategoriesByType.Ingreso && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor: COLORS.Ingreso,
                              }}
                            />
                            <span className="text-xs font-medium">Ingreso</span>
                          </div>
                          <div className="ml-5">
                            <p className="text-sm font-semibold">
                              {topCategoriesByType.Ingreso.category}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(topCategoriesByType.Ingreso.value)}
                              {" "}
                              ({((topCategoriesByType.Ingreso.value / typeTotals.Ingreso) * 100).toFixed(0)}%)
                            </p>
                          </div>
                        </div>
                      )}
                      {topCategoriesByType.Gasto && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor: COLORS.Gasto,
                              }}
                            />
                            <span className="text-xs font-medium">Gasto</span>
                          </div>
                          <div className="ml-5">
                            <p className="text-sm font-semibold">
                              {topCategoriesByType.Gasto.category}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(topCategoriesByType.Gasto.value)}
                              {" "}
                              ({((topCategoriesByType.Gasto.value / typeTotals.Gasto) * 100).toFixed(0)}%)
                            </p>
                          </div>
                        </div>
                      )}
                      {topCategoriesByType.Inversión && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor: COLORS.Inversión,
                              }}
                            />
                            <span className="text-xs font-medium">Inversión</span>
                          </div>
                          <div className="ml-5">
                            <p className="text-sm font-semibold">
                              {topCategoriesByType.Inversión.category}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(topCategoriesByType.Inversión.value)}
                              {" "}
                              ({((topCategoriesByType.Inversión.value / typeTotals.Inversión) * 100).toFixed(0)}%)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t">
                    <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                      Resumen Total
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total movido:</span>
                        <span className="font-semibold">{formatCurrency(totalAmount)}</span>
                      </div>
                      {typeTotals.Ingreso > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ingresos:</span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(typeTotals.Ingreso)}
                          </span>
                        </div>
                      )}
                      {typeTotals.Gasto > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Gastos:</span>
                          <span className="font-medium text-red-600">
                            {formatCurrency(typeTotals.Gasto)}
                          </span>
                        </div>
                      )}
                      {typeTotals.Inversión > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Inversiones:</span>
                          <span className="font-medium text-blue-600">
                            {formatCurrency(typeTotals.Inversión)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 rounded-2xl shadow-elevated border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Gastos por Categoría</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={expensesByCategory} layout="vertical">
                  <XAxis 
                    type="number" 
                    stroke="hsl(var(--muted-foreground))" 
                    tickFormatter={formatCurrency} 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    stroke="hsl(var(--muted-foreground))" 
                    width={120} 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "1rem",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[0, 16, 16, 0]} 
                  >
                    {expensesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
