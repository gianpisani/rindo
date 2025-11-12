import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { TrendingUp, TrendingDown, PiggyBank, Wallet } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";

export default function BalanceSummary() {
  const { transactions } = useTransactions();

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

  const balance = totals.income - totals.expenses - totals.investments;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(amount);
  };

  const cards = [
    {
      title: "Ingresos",
      amount: totals.income,
      icon: TrendingUp,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      title: "Gastos",
      amount: totals.expenses,
      icon: TrendingDown,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      title: "Inversiones",
      amount: totals.investments,
      icon: PiggyBank,
      color: "text-info",
      bg: "bg-info/10",
    },
    {
      title: "Balance",
      amount: balance,
      icon: Wallet,
      color: balance >= 0 ? "text-success" : "text-destructive",
      bg: balance >= 0 ? "bg-success/10" : "bg-destructive/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-full ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.color}`}>
              {formatCurrency(card.amount)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}