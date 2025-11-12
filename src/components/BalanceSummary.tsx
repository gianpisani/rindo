import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { TrendingUp, TrendingDown, PiggyBank, Wallet, DollarSign } from "lucide-react";
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

  const disponible = totals.income - totals.expenses - totals.investments;
  const patrimonio = totals.income - totals.expenses;

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
      bg: "bg-success/5",
    },
    {
      title: "Gastos",
      amount: totals.expenses,
      icon: TrendingDown,
      color: "text-destructive",
      bg: "bg-destructive/5",
    },
    {
      title: "Inversiones",
      amount: totals.investments,
      icon: PiggyBank,
      color: "text-info",
      bg: "bg-info/5",
    },
    {
      title: "Patrimonio",
      amount: patrimonio,
      icon: DollarSign,
      color: patrimonio >= 0 ? "text-success" : "text-destructive",
      bg: patrimonio >= 0 ? "bg-success/5" : "bg-destructive/5",
    },
    {
      title: "Disponible",
      amount: disponible,
      icon: Wallet,
      color: disponible >= 0 ? "text-success" : "text-destructive",
      bg: disponible >= 0 ? "bg-success/5" : "bg-destructive/5",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card 
          key={card.title} 
          className="rounded-2xl shadow-elevated border-border/50 hover:shadow-floating transition-all duration-200"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-3 rounded-full ${card.bg} shadow-sm`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`text-xl lg:text-2xl font-semibold ${card.color}`}>
              {formatCurrency(card.amount)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}