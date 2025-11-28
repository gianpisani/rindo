import { CardContent, CardHeader, CardTitle } from "./ui/card";
import { TrendingUp, TrendingDown, PiggyBank, Wallet, DollarSign } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { AnimatedNumber } from "./AnimatedNumber";
import { GlassCard } from "./GlassCard";

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
      color: "text-blue",
      bg: "bg-blue/5",
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
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map((card) => (
        <GlassCard key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-md ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`text-2xl font-semibold ${card.color} tracking-tight`}>
              <AnimatedNumber value={card.amount} />
            </div>
          </CardContent>
        </GlassCard>
      ))}
    </div>
  );
}