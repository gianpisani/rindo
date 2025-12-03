import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { useCategoryInsights } from "@/hooks/useCategoryInsights";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { useTransactions } from "@/hooks/useTransactions";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  Target,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

export function CategoryInsightsWidget() {
  const { transactions } = useTransactions();
  const { limits } = useCategoryLimits();
  const navigate = useNavigate();
  const { categorySpending, insights } = useCategoryInsights(transactions, limits);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      notation: "compact",
    }).format(value);
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "alert":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "achievement":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "opportunity":
        return <Lightbulb className="h-4 w-4 text-yellow-500" />;
      default:
        return <Target className="h-4 w-4 text-blue-500" />;
    }
  };

  // Get top 3 spending categories
  const topCategories = categorySpending.slice(0, 3);

  // Filter insights by priority
  const alertInsights = insights.filter((i) => i.type === "alert");
  const otherInsights = insights.filter((i) => i.type !== "alert");

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Insights de Categorías
            </CardTitle>
            <CardDescription>Este mes</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/category-insights")}
            className="text-xs"
          >
            Ver todo <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {/* Top Categories */}
        {topCategories.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">Top Gastos</h4>
            {topCategories.map((cat) => (
              <div
                key={cat.category}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                onClick={() => navigate("/category-insights")}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">{cat.category}</span>
                  {cat.trend === "up" ? (
                    <TrendingUp className="h-3 w-3 text-red-500 flex-shrink-0" />
                  ) : cat.trend === "down" ? (
                    <TrendingDown className="h-3 w-3 text-green-500 flex-shrink-0" />
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{formatCurrency(cat.amount)}</span>
                  {cat.isOverLimit && (
                    <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Insights */}
        {insights.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">
              Alertas e Insights
            </h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {/* Show alerts first */}
              {alertInsights.slice(0, 2).map((insight, idx) => (
                <Alert
                  key={idx}
                  className="py-2 px-3 cursor-pointer hover:shadow-md transition-shadow border-red-200 bg-red-50/50 dark:bg-red-950/20"
                  onClick={() => navigate("/category-insights")}
                >
                  <div className="flex items-start gap-2">
                    {getInsightIcon(insight.type)}
                    <AlertDescription className="text-xs flex-1">
                      <div className="font-semibold">{insight.title}</div>
                    </AlertDescription>
                  </div>
                </Alert>
              ))}
              {/* Then show other insights */}
              {otherInsights.slice(0, 2).map((insight, idx) => (
                <Alert
                  key={`other-${idx}`}
                  className={`py-2 px-3 cursor-pointer hover:shadow-md transition-shadow ${
                    insight.type === "achievement"
                      ? "border-green-200 bg-green-50/50 dark:bg-green-950/20"
                      : insight.type === "opportunity"
                      ? "border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20"
                      : "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20"
                  }`}
                  onClick={() => navigate("/category-insights")}
                >
                  <div className="flex items-start gap-2">
                    {getInsightIcon(insight.type)}
                    <AlertDescription className="text-xs flex-1">
                      <div className="font-semibold">{insight.title}</div>
                    </AlertDescription>
                  </div>
                </Alert>
              ))}
            </div>
            {insights.length > 4 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => navigate("/category-insights")}
              >
                Ver todos los insights ({insights.length})
              </Button>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No hay insights disponibles aún</p>
            <p className="text-xs mt-1">Agrega más transacciones para obtener análisis</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
