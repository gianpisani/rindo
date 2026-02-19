import { useMemo, useState, useCallback } from "react";
import { useTransactions } from "./useTransactions";
import { BICHO_SHAPES, getScoreColor, type BichoShape } from "@/lib/bicho-shapes";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  eachDayOfInterval,
  differenceInDays,
} from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

export interface DayScore {
  date: string;
  score: number;
  spent: number;
  income: number;
  txCount: number;
  color: string;
  label: string;
}

export interface BichoState {
  level: number;
  shape: BichoShape;
  monthlyScore: number;
  currentStreak: number;
  bestStreak: number;
  monthDays: DayScore[];
  yearDays: DayScore[];
  avgDailyExpense: number;
  totalMonthExpense: number;
  totalMonthIncome: number;
  daysElapsed: number;
  aiMessage: string | null;
  isLoadingAI: boolean;
  generateAIMessage: () => Promise<void>;
}

export function useBicho(): BichoState {
  const { transactions } = useTransactions();
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const computed = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const yearStart = startOfYear(now);

    // Pre-build date → transactions map
    const txByDate: Record<string, typeof transactions> = {};
    for (const t of transactions) {
      const dateStr = format(new Date(t.date), "yyyy-MM-dd");
      if (!txByDate[dateStr]) txByDate[dateStr] = [];
      txByDate[dateStr].push(t);
    }

    // Compute average daily expense over last 90 days
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    let totalRecentExpenses = 0;
    for (const t of transactions) {
      const d = new Date(t.date);
      if (t.type === "Gasto" && d >= ninetyDaysAgo && d <= now) {
        totalRecentExpenses += Number(t.amount);
      }
    }
    const daysInRange = Math.max(1, differenceInDays(now, ninetyDaysAgo));
    const avgDailyExpense = totalRecentExpenses / daysInRange;

    // Build daily scores for the year (up to today)
    const yearInterval = eachDayOfInterval({ start: yearStart, end: now });

    const allDayScores: DayScore[] = yearInterval.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayTxs = txByDate[dateStr] || [];

      const spent = dayTxs
        .filter((t) => t.type === "Gasto")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const income = dayTxs
        .filter((t) => t.type === "Ingreso")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const hasUncategorized = dayTxs.some(
        (t) =>
          t.category_name === "Sin categoría" ||
          t.category_name === "⚡ Analizando..."
      );

      let score: number;
      if (dayTxs.length === 0) {
        score = 60;
      } else if (spent === 0 && income > 0) {
        score = 90;
      } else if (avgDailyExpense === 0) {
        score = spent === 0 ? 70 : 45;
      } else {
        const ratio = spent / avgDailyExpense;
        if (ratio <= 0.3) score = 90;
        else if (ratio <= 0.7) score = 75;
        else if (ratio <= 1.0) score = 60;
        else if (ratio <= 1.5) score = 40;
        else if (ratio <= 2.5) score = 25;
        else score = 10;

        if (income > 0) score = Math.min(100, score + 10);
      }

      if (hasUncategorized) score = Math.max(0, score - 5);

      return {
        date: dateStr,
        score,
        spent,
        income,
        txCount: dayTxs.length,
        color: getScoreColor(score),
        label: format(day, "EEE d MMM", { locale: es }),
      };
    });

    // Month days
    const monthDays = allDayScores.filter((d) => {
      const date = new Date(d.date);
      return date >= monthStart && date <= endOfMonth(now);
    });

    // Monthly score
    const monthlyScore =
      monthDays.length > 0
        ? Math.round(
            monthDays.reduce((sum, d) => sum + d.score, 0) / monthDays.length
          )
        : 50;

    // Streak: count backwards from today
    let currentStreak = 0;
    for (let i = allDayScores.length - 1; i >= 0; i--) {
      if (allDayScores[i].score >= 50) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Best streak: longest run in the year
    let bestStreak = 0;
    let tempStreak = 0;
    for (const day of allDayScores) {
      if (day.score >= 50) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    // Evolution level
    const effectiveScore =
      monthlyScore + Math.min(10, Math.floor(currentStreak / 3));
    let level: number;
    if (effectiveScore >= 75) level = 4;
    else if (effectiveScore >= 60) level = 3;
    else if (effectiveScore >= 40) level = 2;
    else level = 1;

    const totalMonthExpense = monthDays.reduce((s, d) => s + d.spent, 0);
    const totalMonthIncome = monthDays.reduce((s, d) => s + d.income, 0);

    return {
      level,
      shape: BICHO_SHAPES[level],
      monthlyScore,
      currentStreak,
      bestStreak,
      monthDays,
      yearDays: allDayScores,
      avgDailyExpense,
      totalMonthExpense,
      totalMonthIncome,
      daysElapsed: monthDays.length,
    };
  }, [transactions]);

  const generateAIMessage = useCallback(async () => {
    if (isLoadingAI) return;
    setIsLoadingAI(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bicho-ai`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            level: computed.level,
            levelName: computed.shape.name,
            monthlyScore: computed.monthlyScore,
            currentStreak: computed.currentStreak,
            bestStreak: computed.bestStreak,
            avgDailyExpense: computed.avgDailyExpense,
            totalMonthExpense: computed.totalMonthExpense,
            totalMonthIncome: computed.totalMonthIncome,
            daysElapsed: computed.daysElapsed,
          }),
        }
      );

      const result = await response.json();
      if (result.success && result.message) {
        setAiMessage(result.message);
      }
    } catch (error) {
      console.error("Error generating bicho AI message:", error);
    } finally {
      setIsLoadingAI(false);
    }
  }, [computed, isLoadingAI]);

  return {
    ...computed,
    aiMessage,
    isLoadingAI,
    generateAIMessage,
  };
}
