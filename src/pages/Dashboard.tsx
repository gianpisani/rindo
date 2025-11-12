import Layout from "@/components/Layout";
import BalanceSummary from "@/components/BalanceSummary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTransactions } from "@/hooks/useTransactions";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { es } from "date-fns/locale";

const COLORS = {
  Ingreso: "hsl(var(--chart-1))",
  Gasto: "hsl(var(--chart-2))",
  Inversión: "hsl(var(--chart-3))",
};

export default function Dashboard() {
  const { transactions } = useTransactions();

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
      month: format(month, "MMM yyyy", { locale: es }),
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
        acc.push({ name: t.category_name, value: Number(t.amount) });
      }
      return acc;
    }, [] as { name: string; value: number }[])
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Type distribution
  const typeDistribution = [
    {
      name: "Ingresos",
      value: transactions
        .filter((t) => t.type === "Ingreso")
        .reduce((sum, t) => sum + Number(t.amount), 0),
    },
    {
      name: "Gastos",
      value: transactions
        .filter((t) => t.type === "Gasto")
        .reduce((sum, t) => sum + Number(t.amount), 0),
    },
    {
      name: "Inversiones",
      value: transactions
        .filter((t) => t.type === "Inversión")
        .reduce((sum, t) => sum + Number(t.amount), 0),
    },
  ].filter((item) => item.value > 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      notation: "compact",
    }).format(value);
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Resumen completo de tus finanzas personales
          </p>
        </div>

        <BalanceSummary />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Evolución Mensual</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--foreground))" />
                  <YAxis stroke="hsl(var(--foreground))" tickFormatter={formatCurrency} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Ingresos"
                    stroke={COLORS.Ingreso}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="Gastos"
                    stroke={COLORS.Gasto}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="Inversiones"
                    stroke={COLORS.Inversión}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribución por Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={typeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {typeDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.name === "Ingresos"
                            ? COLORS.Ingreso
                            : entry.name === "Gastos"
                            ? COLORS.Gasto
                            : COLORS.Inversión
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Gastos por Categoría</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={expensesByCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--foreground))" tickFormatter={formatCurrency} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--foreground))" width={150} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="value" fill={COLORS.Gasto} radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}