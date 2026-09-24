import { useMemo } from "react";
import { summarizeCategoryPeriod } from "@/lib/category-spending";
import { Transaction } from "./useTransactions";
import { CategoryLimit } from "./useCategoryLimits";
import { startOfMonth, endOfMonth, subMonths, format, eachMonthOfInterval } from "date-fns";
import { es } from "date-fns/locale";

export interface CategorySpending {
  category: string;
  amount: number;
  effectiveAmount: number;
  reimbursedAmount: number;
  count: number;
  percentage: number;
  limit?: number;
  alertPercentage?: number;
  isOverLimit: boolean;
  isNearLimit: boolean;
  trend: "up" | "down" | "stable";
  trendPercentage: number;
  transactions: Transaction[];
}

export interface MonthlyComparison {
  month: string;
  year: number;
  categories: {
    [category: string]: number;
  };
}

export interface CategoryInsight {
  type: "alert" | "achievement" | "opportunity" | "pattern";
  title: string;
  description: string;
  category?: string;
  impact?: number;
  /** Budget usage 0–100+ (only for insights that have a limit) */
  percentage?: number;
}

export function useCategoryInsights(
  transactions: Transaction[],
  limits: CategoryLimit[],
  selectedMonth?: Date,
  months: number = 6
) {
  const currentMonth = selectedMonth || new Date();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  const previousMonth = subMonths(currentMonth, 1);
  const prevMonthStart = startOfMonth(previousMonth);
  const prevMonthEnd = endOfMonth(previousMonth);

  const currentSpending = useMemo(() => summarizeCategoryPeriod(transactions, monthStart, monthEnd), [transactions, monthStart, monthEnd]);
  const previousSpending = useMemo(() => summarizeCategoryPeriod(transactions, prevMonthStart, prevMonthEnd), [transactions, prevMonthStart, prevMonthEnd]);

  // Get all unique categories from all transactions (Gastos only)
  const allCategories = useMemo(() => {
    const categorySet = new Set<string>();
    transactions
      .filter((t) => t.type === "Gasto")
      .forEach((t) => categorySet.add(t.category_name));
    
    // Also add categories that have limits but no transactions yet
    limits.forEach((l) => categorySet.add(l.category_name));
    
    return Array.from(categorySet);
  }, [transactions, limits]);

  // Calculate spending by category for current month
  const categorySpending = useMemo((): CategorySpending[] => {
    const spendingMap = new Map<string, CategorySpending>();
    const totalSpending = [...currentSpending.values()].reduce((sum, row) => sum + row.effectiveAmount, 0);

    // Initialize ALL categories (even those with no spending this month)
    allCategories.forEach((category) => {
      const limit = limits.find((l) => l.category_name === category);
      spendingMap.set(category, {
        category,
        amount: 0,
        effectiveAmount: 0,
        reimbursedAmount: 0,
        count: 0,
        percentage: 0,
        limit: limit?.monthly_limit,
        alertPercentage: limit?.alert_at_percentage,
        isOverLimit: false,
        isNearLimit: false,
        trend: "stable",
        trendPercentage: 0,
        transactions: [],
      });
    });

    currentSpending.forEach((row, category) => {
      const spending = spendingMap.get(category);
      if (spending) Object.assign(spending, row);
    });

    // Calculate percentages, limits, and trends
    const result: CategorySpending[] = [];
    spendingMap.forEach((spending) => {
      spending.percentage = totalSpending > 0 ? (spending.effectiveAmount / totalSpending) * 100 : 0;

      // Check limits using effective amount
      if (spending.limit) {
        const usagePercentage = spending.effectiveAmount > 0 ? (spending.effectiveAmount / spending.limit) * 100 : 0;
        spending.isOverLimit = usagePercentage > 100;
        spending.isNearLimit = usagePercentage >= (spending.alertPercentage || 80) && !spending.isOverLimit;
      }

      // Calculate trend using effective amounts
      const prevAmount = previousSpending.get(spending.category)?.effectiveAmount || 0;
      if (prevAmount > 0 && spending.effectiveAmount > 0) {
        const change = ((spending.effectiveAmount - prevAmount) / prevAmount) * 100;
        spending.trendPercentage = Math.abs(change);
        if (change > 5) {
          spending.trend = "up";
        } else if (change < -5) {
          spending.trend = "down";
        } else {
          spending.trend = "stable";
        }
      } else if (prevAmount > 0 && spending.effectiveAmount === 0) {
        spending.trend = "down";
        spending.trendPercentage = 100;
      } else if (prevAmount === 0 && spending.effectiveAmount > 0) {
        spending.trend = "up";
        spending.trendPercentage = 100;
      }

      result.push(spending);
    });

    // Sort: categories with spending first (by amount), then alphabetically
    return result.sort((a, b) => {
      if (a.amount > 0 && b.amount === 0) return -1;
      if (a.amount === 0 && b.amount > 0) return 1;
      if (a.amount > 0 && b.amount > 0) return b.effectiveAmount - a.effectiveAmount;
      return a.category.localeCompare(b.category);
    });
  }, [currentSpending, previousSpending, limits, allCategories]);

  // Get last N months comparison
  const monthlyComparison = useMemo((): MonthlyComparison[] => {
    const last6Months = eachMonthOfInterval({
      start: subMonths(currentMonth, months - 1),
      end: currentMonth,
    });

    return last6Months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const categories = Object.fromEntries(
        [...summarizeCategoryPeriod(transactions, monthStart, monthEnd)]
          .map(([category, row]) => [category, row.effectiveAmount])
      );

      return {
        month: format(month, "MMM", { locale: es }),
        year: month.getFullYear(),
        categories,
      };
    });
  }, [transactions, currentMonth, months]);

  // Generate insights
  const insights = useMemo((): CategoryInsight[] => {
    const insights: CategoryInsight[] = [];

    // Alerts for over limit (using effectiveAmount)
    // El porcentaje no va en la descripción: viaja en `percentage` y cada
    // vista decide cómo mostrarlo (el panel de Insights lo pinta al lado).
    categorySpending.forEach((spending) => {
      const pct = Math.round((spending.effectiveAmount / (spending.limit || 1)) * 100);
      if (spending.isOverLimit) {
        insights.push({
          type: "alert",
          title: `Límite superado en ${spending.category}`,
          description: `Has gastado $${spending.effectiveAmount.toLocaleString("es-CL")} de $${spending.limit?.toLocaleString("es-CL")}`,
          category: spending.category,
          impact: spending.effectiveAmount - (spending.limit || 0),
          percentage: pct,
        });
      } else if (spending.isNearLimit) {
        insights.push({
          type: "alert",
          title: `Cerca del límite en ${spending.category}`,
          description: `Has gastado $${spending.effectiveAmount.toLocaleString("es-CL")} de $${spending.limit?.toLocaleString("es-CL")}`,
          category: spending.category,
          percentage: pct,
        });
      }
    });

    // Achievements for staying under budget (using effectiveAmount)
    categorySpending.forEach((spending) => {
      if (spending.limit && spending.effectiveAmount < spending.limit * 0.9) {
        const pct = Math.round((spending.effectiveAmount / spending.limit) * 100);
        insights.push({
          type: "achievement",
          title: `Bien hecho en ${spending.category}`,
          description: `Te quedan $${(spending.limit - spending.effectiveAmount).toLocaleString("es-CL")} del presupuesto`,
          category: spending.category,
          percentage: pct,
        });
      }
    });

    // Trends - increasing spending
    categorySpending.forEach((spending) => {
      if (spending.trend === "up" && spending.trendPercentage > 15) {
        insights.push({
          type: "pattern",
          title: `Aumento en ${spending.category}`,
          description: `Gastaste ${spending.trendPercentage.toFixed(0)}% más que el mes pasado (+$${(spending.effectiveAmount - (monthlyComparison[monthlyComparison.length - 2]?.categories[spending.category] || 0)).toLocaleString("es-CL")})`,
          category: spending.category,
        });
      }
    });

    // Trends - decreasing spending (achievement)
    categorySpending.forEach((spending) => {
      if (spending.trend === "down" && spending.trendPercentage > 15) {
        const saved = (monthlyComparison[monthlyComparison.length - 2]?.categories[spending.category] || 0) - spending.effectiveAmount;
        insights.push({
          type: "achievement",
          title: `Ahorro en ${spending.category}`,
          description: `Gastaste ${spending.trendPercentage.toFixed(0)}% menos que el mes pasado (ahorraste $${saved.toLocaleString("es-CL")})`,
          category: spending.category,
          impact: saved,
        });
      }
    });

    // Opportunity - high frequency small transactions
    categorySpending.forEach((spending) => {
      if (spending.count >= 10 && spending.effectiveAmount / spending.count < 20000) {
        insights.push({
          type: "opportunity",
          title: `Muchas transacciones pequeñas en ${spending.category}`,
          description: `${spending.count} transacciones con promedio de $${(spending.effectiveAmount / spending.count).toLocaleString("es-CL")}`,
          category: spending.category,
        });
      }
    });

    return insights;
  }, [categorySpending, monthlyComparison]);

  return {
    categorySpending,
    monthlyComparison,
    insights,
    currentMonth,
    previousMonth,
    totalSpending: categorySpending.reduce((sum, c) => sum + c.effectiveAmount, 0),
  };
}
