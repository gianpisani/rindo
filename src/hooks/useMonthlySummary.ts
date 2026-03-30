import { useMemo } from "react";
import { Transaction } from "./useTransactions";
import { Category } from "./useCategories";
import { CategoryLimit } from "./useCategoryLimits";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  eachDayOfInterval,
  format,
  getDay,
} from "date-fns";
import { es } from "date-fns/locale";

export interface MonthlyKPI {
  income: number;
  expenses: number;
  investments: number;
  balance: number;
  savingsRate: number;
  prevIncome: number;
  prevExpenses: number;
  prevInvestments: number;
  prevBalance: number;
  prevSavingsRate: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  effectiveAmount: number;
  reimbursedAmount: number;
  count: number;
  percentage: number;
  color: string;
  prevAmount: number;
  trend: "up" | "down" | "stable";
  trendPercentage: number;
  limit?: number;
  limitUsage?: number;
  isOverLimit: boolean;
  isNearLimit: boolean;
}

export interface BudgetSummary {
  totalBudget: number;
  totalAllocated: number;
  totalEffectiveSpent: number;
  budgetRemaining: number;
  usagePercentage: number;
}

export interface DailySpending {
  day: number;
  date: string;
  amount: number;
  dayName: string;
  isWeekend: boolean;
}

export function useMonthlySummary(
  transactions: Transaction[],
  categories: Category[],
  limits: CategoryLimit[],
  selectedMonth: Date,
  totalBudget?: number
) {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const prevMonth = subMonths(selectedMonth, 1);
  const prevMonthStart = startOfMonth(prevMonth);
  const prevMonthEnd = endOfMonth(prevMonth);

  const currentTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        const d = new Date(t.date);
        return d >= monthStart && d <= monthEnd;
      }),
    [transactions, monthStart, monthEnd]
  );

  const prevTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        const d = new Date(t.date);
        return d >= prevMonthStart && d <= prevMonthEnd;
      }),
    [transactions, prevMonthStart, prevMonthEnd]
  );

  const kpis = useMemo((): MonthlyKPI => {
    const calc = (txns: Transaction[]) => {
      const income = txns
        .filter((t) => t.type === "Ingreso")
        .reduce((s, t) => s + Number(t.amount), 0);
      const expenses = txns
        .filter((t) => t.type === "Gasto")
        .reduce((s, t) => s + Number(t.amount), 0);
      const investments = txns
        .filter((t) => t.type === "Inversión")
        .reduce((s, t) => s + Number(t.amount), 0);
      return {
        income,
        expenses,
        investments,
        balance: income - expenses - investments,
        savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
      };
    };

    const cur = calc(currentTransactions);
    const prev = calc(prevTransactions);
    return {
      ...cur,
      prevIncome: prev.income,
      prevExpenses: prev.expenses,
      prevInvestments: prev.investments,
      prevBalance: prev.balance,
      prevSavingsRate: prev.savingsRate,
    };
  }, [currentTransactions, prevTransactions]);

  const categoryBreakdown = useMemo((): CategoryBreakdown[] => {
    const curExpenses = currentTransactions.filter((t) => t.type === "Gasto");
    const prevExpenses = prevTransactions.filter((t) => t.type === "Gasto");
    const totalExp = curExpenses.reduce((s, t) => s + Number(t.amount), 0);

    const curMap = new Map<string, { amount: number; count: number }>();
    curExpenses.forEach((t) => {
      const e = curMap.get(t.category_name) || { amount: 0, count: 0 };
      e.amount += Number(t.amount);
      e.count += 1;
      curMap.set(t.category_name, e);
    });

    const prevMap = new Map<string, number>();
    prevExpenses.forEach((t) => {
      prevMap.set(
        t.category_name,
        (prevMap.get(t.category_name) || 0) + Number(t.amount)
      );
    });

    const result: CategoryBreakdown[] = [];
    curMap.forEach(({ amount, count }, category) => {
      const cat = categories.find((c) => c.name === category);
      const prevAmount = prevMap.get(category) || 0;
      const change =
        prevAmount > 0
          ? ((amount - prevAmount) / prevAmount) * 100
          : amount > 0
          ? 100
          : 0;
      const lim = limits.find((l) => l.category_name === category);
      const limitUsage = lim ? (amount / lim.monthly_limit) * 100 : undefined;

      result.push({
        category,
        amount,
        count,
        percentage: totalExp > 0 ? (amount / totalExp) * 100 : 0,
        color: cat?.color || "#6b7280",
        prevAmount,
        trend: change > 5 ? "up" : change < -5 ? "down" : "stable",
        trendPercentage: Math.abs(change),
        limit: lim?.monthly_limit,
        limitUsage,
        isOverLimit: limitUsage ? limitUsage > 100 : false,
        isNearLimit: limitUsage
          ? limitUsage >= (lim?.alert_at_percentage || 80) && limitUsage <= 100
          : false,
      });
    });

    return result.sort((a, b) => b.amount - a.amount);
  }, [currentTransactions, prevTransactions, categories, limits]);

  const dailySpending = useMemo((): DailySpending[] => {
    const now = new Date();
    const isCurrentMonth =
      now.getFullYear() === selectedMonth.getFullYear() &&
      now.getMonth() === selectedMonth.getMonth();
    const end = isCurrentMonth
      ? new Date(Math.min(now.getTime(), monthEnd.getTime()))
      : monthEnd;

    return eachDayOfInterval({ start: monthStart, end }).map((day) => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const amount = currentTransactions
        .filter((t) => {
          const d = new Date(t.date);
          return t.type === "Gasto" && d >= dayStart && d <= dayEnd;
        })
        .reduce((s, t) => s + Number(t.amount), 0);

      const dow = getDay(day);
      return {
        day: day.getDate(),
        date: format(day, "d MMM", { locale: es }),
        amount,
        dayName: format(day, "EEE", { locale: es }),
        isWeekend: dow === 0 || dow === 6,
      };
    });
  }, [currentTransactions, monthStart, monthEnd, selectedMonth]);

  const dailyStats = useMemo(() => {
    const withSpending = dailySpending.filter((d) => d.amount > 0);
    const total = withSpending.reduce((s, d) => s + d.amount, 0);
    return {
      avgDaily: dailySpending.length > 0 ? total / dailySpending.length : 0,
      peakDay:
        withSpending.length > 0
          ? withSpending.reduce((max, d) =>
              d.amount > max.amount ? d : max
            )
          : null,
      totalDays: dailySpending.length,
      daysWithSpending: withSpending.length,
    };
  }, [dailySpending]);

  const cardSpending = useMemo(() => {
    const map = new Map<string, number>();
    currentTransactions
      .filter((t) => t.card_id)
      .forEach((t) => {
        map.set(t.card_id!, (map.get(t.card_id!) || 0) + Number(t.amount));
      });
    return map;
  }, [currentTransactions]);

  return {
    kpis,
    categoryBreakdown,
    dailySpending,
    dailyStats,
    cardSpending,
    transactionCount: currentTransactions.length,
  };
}
