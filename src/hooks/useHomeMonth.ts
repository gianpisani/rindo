import { useMemo } from "react";
import type { Transaction } from "@/hooks/useTransactions";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { useMonthlyBudget } from "@/hooks/useMonthlyBudget";
import { usePeriodConfig } from "@/hooks/usePeriodConfig";
import { useRealFlows } from "@/hooks/useRealFlows";
import { dayOfPeriod, periodEndOf, periodNameDate, shiftPeriod } from "@/lib/period";
import { computeRealFlows, SWEEP_ALERT_THRESHOLD, type RealFlowsConfig } from "@/lib/real-flows";
import { limitUsage, summarizeCategoryPeriod } from "@/lib/category-spending";
import { computeMonthPace } from "@/lib/month-pace";
import {
  categoryPeriodRows,
  categorySummary,
  rankCategorySpend,
  totalSpend,
  withoutTransit,
} from "@/lib/home-summary";

export function useHomeMonth(transactions: Transaction[]) {
  const { limits } = useCategoryLimits();
  const { budget } = useMonthlyBudget();
  const now = new Date();
  const period = usePeriodConfig();
  const { startDay } = period;
  const thisPeriod = period.currentPeriod;
  const periodEnd = periodEndOf(thisPeriod, startDay);
  const lastMonth = shiftPeriod(thisPeriod, -1, startDay);
  const lastMonthName = periodNameDate(lastMonth, startDay);

  const flowConfig = useMemo<Partial<RealFlowsConfig>>(() => ({ periodStartDay: startDay }), [startDay]);
  const currentFlows = useRealFlows(transactions, thisPeriod, flowConfig);
  const lastMonthFlows = useMemo(
    () => computeRealFlows(transactions, lastMonth, flowConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, lastMonth.getTime(), flowConfig]
  );

  const sweepAlert = useMemo(() => {
    if (!budget?.savings_goal || dayOfPeriod(now, thisPeriod) > 7) return null;
    if (lastMonthFlows.consumoBruto === 0 && lastMonthFlows.ingresoReal === 0)
      return null;
    const saved = lastMonthFlows.ingresoReal - lastMonthFlows.consumoNeto;
    const gap = saved - lastMonthFlows.invertido;
    return gap > SWEEP_ALERT_THRESHOLD ? { amount: gap } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget?.savings_goal, lastMonthFlows]);

  const limitRows = useMemo(() => limitUsage(transactions, limits, thisPeriod, periodEnd), [transactions, limits, thisPeriod, periodEnd]);
  const overLimits = limitRows.filter((row) => row.state === "over");

  const monthPace = useMemo(
    () => computeMonthPace(transactions, now, { startDay }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, now.getFullYear(), now.getMonth(), now.getDate(), startDay]
  );
  const hasPace = monthPace.typical !== null || monthPace.spentSoFar > 0;

  const monthSpend = useMemo(
    () => withoutTransit(summarizeCategoryPeriod(transactions, thisPeriod, periodEnd)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, thisPeriod.getTime(), periodEnd.getTime()]
  );
  const monthExpenses = totalSpend(monthSpend.values());
  const spendBreakdown = rankCategorySpend(monthSpend);

  const categoryDetail = (category: string) => ({
    summary: categorySummary(monthSpend.get(category)),
    transactions: categoryPeriodRows(transactions, category, thisPeriod, periodEnd),
  });

  return {
    period,
    thisPeriod,
    lastMonthName,
    flowConfig,
    currentFlows,
    sweepAlert,
    hasLimits: limitRows.length > 0,
    overLimits,
    monthPace,
    hasPace,
    monthExpenses,
    spendBreakdown,
    categoryDetail,
  };
}
