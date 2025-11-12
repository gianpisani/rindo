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
  Inversión: "text-info",
};

export default function RecentTransactions() {
  const { transactions } = useTransactions();
  const recentTransactions = transactions.slice(0, 3);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Últimas Transacciones</CardTitle>
        <Link to="/transactions">
          <Button variant="ghost" size="sm" className="gap-2">
            Ver todo
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {recentTransactions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No hay transacciones aún. ¡Agrega tu primera transacción arriba!
          </p>
        ) : (
          <div className="space-y-4">
            {recentTransactions.map((transaction) => {
              const Icon = typeIcons[transaction.type];
              const colorClass = typeColors[transaction.type];

              return (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full bg-accent`}>
                      <Icon className={`h-4 w-4 ${colorClass}`} />
                    </div>
                    <div>
                      <p className="font-medium">{transaction.category_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(transaction.date), "d 'de' MMMM, yyyy", {
                          locale: es,
                        })}
                      </p>
                      {transaction.detail && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {transaction.detail}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className={`font-bold ${colorClass}`}>
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