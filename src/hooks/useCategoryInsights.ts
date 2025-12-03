import { useMemo } from "react";
import { Transaction } from "./useTransactions";
import { CategoryLimit } from "./useCategoryLimits";
import { startOfMonth, endOfMonth, subMonths, format, eachMonthOfInterval } from "date-fns";
import { es } from "date-fns/locale";

export interface CategorySpending {
  category: string;
  amount: number;
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
}

export function useCategoryInsights(
  transactions: Transaction[],
  limits: CategoryLimit[],
  selectedMonth?: Date
) {
  const currentMonth = selectedMonth || new Date();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  const previousMonth = subMonths(currentMonth, 1);
  const prevMonthStart = startOfMonth(previousMonth);
  const prevMonthEnd = endOfMonth(previousMonth);

  // Filter transactions by month and type (only Gastos)
  const currentMonthTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const date = new Date(t.date);
      return t.type === "Gasto" && date >= monthStart && date <= monthEnd;
    });
  }, [transactions, monthStart, monthEnd]);

  const previousMonthTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const date = new Date(t.date);
      return t.type === "Gasto" && date >= prevMonthStart && date <= prevMonthEnd;
    });
  }, [transactions, prevMonthStart, prevMonthEnd]);

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
    let totalSpending = 0;

    // Initialize ALL categories (even those with no spending this month)
    allCategories.forEach((category) => {
      const limit = limits.find((l) => l.category_name === category);
      spendingMap.set(category, {
        category,
        amount: 0,
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

    // Calculate current month spending
    currentMonthTransactions.forEach((t) => {
      const category = t.category_name;
      const amount = Number(t.amount);
      totalSpending += amount;

      const spending = spendingMap.get(category)!;
      spending.amount += amount;
      spending.count += 1;
      spending.transactions.push(t);
    });

    // Calculate previous month spending for trend
    const prevSpendingMap = new Map<string, number>();
    previousMonthTransactions.forEach((t) => {
      const category = t.category_name;
      const amount = Number(t.amount);
      prevSpendingMap.set(category, (prevSpendingMap.get(category) || 0) + amount);
    });

    // Calculate percentages, limits, and trends
    const result: CategorySpending[] = [];
    spendingMap.forEach((spending) => {
      spending.percentage = totalSpending > 0 ? (spending.amount / totalSpending) * 100 : 0;

      // Check limits
      if (spending.limit) {
        const usagePercentage = spending.amount > 0 ? (spending.amount / spending.limit) * 100 : 0;
        spending.isOverLimit = usagePercentage > 100;
        spending.isNearLimit = usagePercentage >= (spending.alertPercentage || 80) && !spending.isOverLimit;
      }

      // Calculate trend
      const prevAmount = prevSpendingMap.get(spending.category) || 0;
      if (prevAmount > 0 && spending.amount > 0) {
        const change = ((spending.amount - prevAmount) / prevAmount) * 100;
        spending.trendPercentage = Math.abs(change);
        if (change > 5) {
          spending.trend = "up";
        } else if (change < -5) {
          spending.trend = "down";
        } else {
          spending.trend = "stable";
        }
      } else if (prevAmount > 0 && spending.amount === 0) {
        // Had spending before, now zero
        spending.trend = "down";
        spending.trendPercentage = 100;
      } else if (prevAmount === 0 && spending.amount > 0) {
        // No spending before, now has spending
        spending.trend = "up";
        spending.trendPercentage = 100;
      }

      result.push(spending);
    });

    // Sort: categories with spending first (by amount), then alphabetically
    return result.sort((a, b) => {
      if (a.amount > 0 && b.amount === 0) return -1;
      if (a.amount === 0 && b.amount > 0) return 1;
      if (a.amount > 0 && b.amount > 0) return b.amount - a.amount;
      return a.category.localeCompare(b.category);
    });
  }, [currentMonthTransactions, previousMonthTransactions, limits, allCategories]);

  // Get last 6 months comparison
  const monthlyComparison = useMemo((): MonthlyComparison[] => {
    const last6Months = eachMonthOfInterval({
      start: subMonths(currentMonth, 5),
      end: currentMonth,
    });

    return last6Months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const monthTransactions = transactions.filter((t) => {
        const date = new Date(t.date);
        return t.type === "Gasto" && date >= monthStart && date <= monthEnd;
      });

      const categories: { [key: string]: number } = {};
      monthTransactions.forEach((t) => {
        categories[t.category_name] = (categories[t.category_name] || 0) + Number(t.amount);
      });

      return {
        month: format(month, "MMM", { locale: es }),
        year: month.getFullYear(),
        categories,
      };
    });
  }, [transactions, currentMonth]);

  // Generate insights
  const insights = useMemo((): CategoryInsight[] => {
    const insights: CategoryInsight[] = [];

    // Alerts for over limit
    categorySpending.forEach((spending) => {
      if (spending.isOverLimit) {
        insights.push({
          type: "alert",
          title: `Límite superado en ${spending.category}`,
          description: `Has gastado $${spending.amount.toLocaleString("es-CL")} de $${spending.limit?.toLocaleString("es-CL")} (${((spending.amount / (spending.limit || 1)) * 100).toFixed(0)}%)`,
          category: spending.category,
          impact: spending.amount - (spending.limit || 0),
        });
      } else if (spending.isNearLimit) {
        insights.push({
          type: "alert",
          title: `Cerca del límite en ${spending.category}`,
          description: `Has gastado $${spending.amount.toLocaleString("es-CL")} de $${spending.limit?.toLocaleString("es-CL")} (${((spending.amount / (spending.limit || 1)) * 100).toFixed(0)}%)`,
          category: spending.category,
        });
      }
    });

    // Achievements for staying under budget
    categorySpending.forEach((spending) => {
      if (spending.limit && spending.amount < spending.limit * 0.9) {
        insights.push({
          type: "achievement",
          title: `Bien hecho en ${spending.category}`,
          description: `Te quedan $${(spending.limit - spending.amount).toLocaleString("es-CL")} del presupuesto`,
          category: spending.category,
        });
      }
    });

    // Trends - increasing spending
    categorySpending.forEach((spending) => {
      if (spending.trend === "up" && spending.trendPercentage > 15) {
        insights.push({
          type: "pattern",
          title: `Aumento en ${spending.category}`,
          description: `Gastaste ${spending.trendPercentage.toFixed(0)}% más que el mes pasado (+$${(spending.amount - (monthlyComparison[monthlyComparison.length - 2]?.categories[spending.category] || 0)).toLocaleString("es-CL")})`,
          category: spending.category,
        });
      }
    });

    // Trends - decreasing spending (achievement)
    categorySpending.forEach((spending) => {
      if (spending.trend === "down" && spending.trendPercentage > 15) {
        const saved = (monthlyComparison[monthlyComparison.length - 2]?.categories[spending.category] || 0) - spending.amount;
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
      if (spending.count >= 10 && spending.amount / spending.count < 20000) {
        insights.push({
          type: "opportunity",
          title: `Muchas transacciones pequeñas en ${spending.category}`,
          description: `${spending.count} transacciones con promedio de $${(spending.amount / spending.count).toLocaleString("es-CL")}`,
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
    totalSpending: categorySpending.reduce((sum, c) => sum + c.amount, 0),
  };
}
