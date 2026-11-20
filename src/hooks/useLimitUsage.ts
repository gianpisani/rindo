import { useMemo } from "react";
import type { Transaction } from "@/hooks/useTransactions";
import { useCategoryLimits } from "@/hooks/useCategoryLimits";
import { usePeriodConfig } from "@/hooks/usePeriodConfig";
import { limitUsage } from "@/lib/category-spending";
import { limitProjection, typicalRemainingSpend } from "@/lib/limit-projection";
import { periodEndOf } from "@/lib/period";

export function useLimitUsage(transactions: Transaction[], todayInPeriod: number) {
  const { limits } = useCategoryLimits();
  const { currentPeriod: thisPeriod, startDay } = usePeriodConfig();

  const usage = useMemo(
    () => limitUsage(transactions, limits, thisPeriod, periodEndOf(thisPeriod, startDay)),
    [transactions, limits, thisPeriod, startDay],
  );
  const remaining = useMemo(
    () => typicalRemainingSpend(transactions, thisPeriod, todayInPeriod, startDay),
    [transactions, thisPeriod, todayInPeriod, startDay],
  );

  const rows = usage.map((row) => ({ ...row, projection: limitProjection(row, remaining.get(row.category) ?? 0) }));

  return {
    rows,
    total: rows.reduce((s, r) => s + r.limit, 0),
    anyOver: rows.some((r) => r.state === "over"),
  };
}

export type LimitRowUsage = ReturnType<typeof useLimitUsage>["rows"][number];
