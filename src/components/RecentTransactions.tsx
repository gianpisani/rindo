import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const typeIcons = {
  Ingreso: TrendingUp,
  Gasto: TrendingDown,
  Inversión: PiggyBank,
};

const typeColors = {
  Ingreso: "text-success",
  Gasto: "text-destructive",
  Inversión: "text-blue",
};

const typeBg = {
  Ingreso: "bg-success/5",
  Gasto: "bg-destructive/5",
  Inversión: "bg-blue/5",
};

export default function RecentTransactions() {
  const { transactions } = useTransactions();
  const recentTransactions = transactions.slice(0, 5);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(amount);
  };

  return (
    <Card className="rounded-2xl shadow-elevated border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">Últimas Transacciones</CardTitle>
        <Link to="/transactions">
          <Button variant="ghost" size="sm" className="gap-2 rounded-full -mr-2">
            Ver todo
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {recentTransactions.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            No hay transacciones aún. ¡Agrega tu primera transacción!
          </p>
        ) : (
          <div className="space-y-3">
            {recentTransactions.map((transaction) => {
              const Icon = typeIcons[transaction.type];
              const colorClass = typeColors[transaction.type];
              const bgClass = typeBg[transaction.type];

              return (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 rounded-full border border-border/50 hover:shadow-sm hover:border-border transition-all duration-200"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={`p-3 rounded-full ${bgClass} flex-shrink-0`}>
                      <Icon className={`h-5 w-5 ${colorClass}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{transaction.category_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(transaction.date), "d 'de' MMM", {
                          locale: es,
                        })}
                      </p>
                      {transaction.detail && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {transaction.detail}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className={`font-semibold text-sm ${colorClass} ml-2 flex-shrink-0`}>
                    {formatCurrency(Number(transaction.amount))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}