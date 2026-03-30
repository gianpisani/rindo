import { useMemo } from "react";
import { GlassCard } from "./GlassCard";
import { cn } from "@/lib/utils";
import { Target } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import NumberFlow from "@number-flow/react";
import { Link } from "react-router-dom";

interface CategoryBudgetItem {
  category: string;
  allocated: number;
  spent: number;
  color: string;
}

interface BudgetWheelProps {
  totalBudget: number;
  totalSpent: number;
  categoryBreakdown: CategoryBudgetItem[];
  isPrivacyMode?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatCompact = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    notation: "compact",
  }).format(value);

export function BudgetWheel({
  totalBudget,
  totalSpent,
  categoryBreakdown,
  isPrivacyMode,
}: BudgetWheelProps) {
  const remaining = totalBudget - totalSpent;
  const usagePercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const ringColor = useMemo(() => {
    if (usagePercent >= 100) return "#e11d48"; // rose
    if (usagePercent >= 80) return "#f59e0b"; // amber
    return "#10b981"; // emerald
  }, [usagePercent]);

  const pieData = [
    { name: "Gastado", value: Math.min(totalSpent, totalBudget) },
    { name: "Restante", value: Math.max(0, remaining) },
  ];

  // Only show categories with allocated budgets, sorted by spent desc
  const budgetedCategories = categoryBreakdown
    .filter((c) => c.allocated > 0)
    .sort((a, b) => b.spent - a.spent);

  if (totalBudget <= 0) {
    return (
      <GlassCard className="p-6">
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="p-3 rounded-full bg-primary/10 mb-3">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Configura tu presupuesto
          </h3>
          <p className="text-xs text-muted-foreground mb-3 max-w-[240px]">
            Define un presupuesto mensual para controlar tus gastos
          </p>
          <Link
            to="/budget"
            className="text-xs font-medium text-primary hover:underline"
          >
            Ir a Presupuesto →
          </Link>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <div className="flex items-center gap-2 px-6 pt-5 pb-2 border-b border-border/20">
        <Target className="h-3.5 w-3.5 text-primary/60" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Presupuesto Mensual
        </h3>
      </div>
      <div className="p-6 pt-4">
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Ring Chart */}
          <div className="relative w-[180px] h-[180px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={2}
                  strokeWidth={0}
                  className={cn(isPrivacyMode && "privacy-blur")}
                >
                  <Cell fill={ringColor} />
                  <Cell fill="hsl(var(--muted))" opacity={0.3} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={cn("text-center", isPrivacyMode && "privacy-blur")}>
                <p
                  className={cn(
                    "text-lg font-bold font-mono tabular-nums",
                    remaining >= 0 ? "text-foreground" : "text-rose-500"
                  )}
                >
                  {formatCompact(remaining)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  de {formatCompact(totalBudget)}
                </p>
                <p
                  className={cn(
                    "text-xs font-semibold mt-0.5",
                    usagePercent >= 100
                      ? "text-rose-500"
                      : usagePercent >= 80
                      ? "text-amber-500"
                      : "text-emerald-500"
                  )}
                >
                  {usagePercent.toFixed(0)}% usado
                </p>
              </div>
            </div>
          </div>

          {/* Category Bars */}
          <div className="flex-1 w-full space-y-3 min-w-0">
            {budgetedCategories.length > 0 ? (
              budgetedCategories.map((cat) => {
                const catUsage =
                  cat.allocated > 0
                    ? (cat.spent / cat.allocated) * 100
                    : 0;
                const catRemaining = cat.allocated - cat.spent;
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-xs font-medium truncate">
                          {cat.category}
                        </span>
                      </div>
                      <div className={cn("flex items-center gap-2 text-xs tabular-nums flex-shrink-0", isPrivacyMode && "privacy-blur")}>
                        <span className="font-mono font-semibold">
                          {formatCompact(cat.spent)}
                        </span>
                        <span className="text-muted-foreground">
                          / {formatCompact(cat.allocated)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(catUsage, 100)}%`,
                          backgroundColor:
                            catUsage > 100
                              ? "#e11d48"
                              : catUsage >= 80
                              ? "#f59e0b"
                              : cat.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">
                  Asigna límites por categoría en{" "}
                  <Link
                    to="/budget"
                    className="text-primary hover:underline"
                  >
                    Presupuesto
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
