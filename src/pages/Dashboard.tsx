import Layout from "@/components/Layout";
import { BalanceCard } from "@/components/BalanceCard";
import ProjectionCard from "@/components/ProjectionCard";
import { MoneyFlowChart } from "@/components/MoneyFlowChart";
import { DashboardGrid } from "@/components/DashboardGrid";
import { DashboardWidget } from "@/components/DashboardWidget";
import { CategoryInsightsWidget } from "@/components/CategoryInsightsWidget";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { TrendingUp, TrendingDown, PiggyBank, Wallet, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, Cell } from "recharts";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { cn } from "@/lib/utils";

const COLORS = {
  Ingreso: "hsl(var(--chart-1))",
  Gasto: "hsl(var(--chart-2))",
  Inversión: "hsl(var(--chart-3))",
};

export default function Dashboard() {
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const { isPrivacyMode } = usePrivacyMode();

  // Calculate totals for balance cards
  const totals = transactions.reduce(
    (acc, transaction) => {
      if (transaction.type === "Ingreso") {
        acc.income += Number(transaction.amount);
      } else if (transaction.type === "Gasto") {
        acc.expenses += Number(transaction.amount);
      } else if (transaction.type === "Inversión") {
        acc.investments += Number(transaction.amount);
      }
      return acc;
    },
    { income: 0, expenses: 0, investments: 0 }
  );

  const disponible = totals.income - totals.expenses - totals.investments;
  const patrimonio = totals.income - totals.expenses;

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Resumen completo de tus finanzas
            </p>
          </div>
        </div>

        <DashboardGrid>
          {/* Balance Cards - Individual widgets */}
          <DashboardWidget key="income" title="Ingresos" icon={TrendingUp}>
            <BalanceCard
              amount={totals.income}
              color="text-success"
              bg="bg-success/5"
            />
          </DashboardWidget>

          <DashboardWidget key="expenses" title="Gastos" icon={TrendingDown}>
            <BalanceCard
              amount={totals.expenses}
              color="text-destructive"
              bg="bg-destructive/5"
            />
          </DashboardWidget>

          <DashboardWidget key="investments" title="Inversiones" icon={PiggyBank}>
            <BalanceCard
              amount={totals.investments}
              color="text-blue"
              bg="bg-blue/5"
            />
          </DashboardWidget>

          <DashboardWidget key="patrimony" title="Patrimonio" icon={DollarSign}>
            <BalanceCard
              amount={patrimonio}
              color={patrimonio >= 0 ? "text-success" : "text-destructive"}
              bg={patrimonio >= 0 ? "bg-success/5" : "bg-destructive/5"}
            />
          </DashboardWidget>

          <DashboardWidget key="available" title="Disponible" icon={Wallet}>
            <BalanceCard
              amount={disponible}
              color={disponible >= 0 ? "text-success" : "text-destructive"}
              bg={disponible >= 0 ? "bg-success/5" : "bg-destructive/5"}
            />
          </DashboardWidget>

          {/* Widget - Category Insights */}
          <DashboardWidget key="insights" title="Insights de Categorías">
            <CategoryInsightsWidget />
          </DashboardWidget>

          {/* Widget - Projection */}
          <DashboardWidget key="projection" title="Proyección Financiera">
            <ProjectionCard />
          </DashboardWidget>

          {/* Widget 3 - Money Flow */}
          <DashboardWidget key="flow" title="Flujo de Dinero">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {format(new Date(), "MMMM yyyy", { locale: es })}
              </p>
              <MoneyFlowChart />
            </div>
          </DashboardWidget>

          {/* Widget 4 - Evolution Chart */}
          <DashboardWidget key="evolution" title="Evolución Mensual">
            <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                <LineChart data={monthlyData} className={cn(isPrivacyMode && "privacy-blur")}>
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
          </DashboardWidget>

          {/* Widget - Expenses Bar Chart */}
          <DashboardWidget key="expensesChart" title="Gastos por Categoría">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <BarChart data={expensesByCategory} layout="vertical" className={cn(isPrivacyMode && "privacy-blur")}>
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
          </DashboardWidget>
        </DashboardGrid>
      </div>
    </Layout>
  );
}
