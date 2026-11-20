import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useMonthlyBudget } from "@/hooks/useMonthlyBudget";
import { usePeriodConfig } from "@/hooks/usePeriodConfig";
import { dayOfPeriod } from "@/lib/period";
import { computeNextMonthSweep, computeSavingsMonths } from "@/lib/savings-goal";
import { SAVINGS_HISTORY_MONTHS, currentSavingsNote, savingsTone } from "@/lib/savings-goal-summary";

export function useSavingsGoal() {
  const { transactions, isLoading } = useTransactions();
  const { budget, isLoading: budgetLoading, upsertBudget } = useMonthlyBudget();

  const today = new Date();
  const period = usePeriodConfig();
  const { startDay } = period;
  const thisPeriod = period.currentPeriod;
  const todayInPeriod = dayOfPeriod(today, thisPeriod);
  const goal = budget?.savings_goal ?? 0;
  const hasGoal = goal > 0;

  const months = useMemo(
    () => computeSavingsMonths(transactions, goal, today, SAVINGS_HISTORY_MONTHS, startDay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, goal, thisPeriod.getTime(), startDay]
  );
  const nextSweeps = useMemo(
    () => computeNextMonthSweep(transactions, today, startDay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, thisPeriod.getTime(), startDay]
  );

  const current = months[months.length - 1];
  const currentTone = savingsTone(current, true, todayInPeriod);

  return {
    transactions,
    loading: isLoading || budgetLoading,
    period,
    today,
    todayInPeriod,
    goal,
    hasGoal,
    months,
    current,
    currentTone,
    metCount: months.filter((m) => m.met).length,
    note: currentSavingsNote({ current, currentTone, goal, nextSweeps, thisPeriod, startDay }),
    saveGoal: (value: number) => upsertBudget.mutate({ savings_goal: value }),
  };
}
