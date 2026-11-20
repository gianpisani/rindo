import { useMemo } from "react";
import type { Transaction } from "./useTransactions";
import { computeRealFlows, type RealFlows, type RealFlowsConfig } from "@/lib/real-flows";

export function useRealFlows(
  transactions: Transaction[],
  month: Date,
  partialConfig?: Partial<RealFlowsConfig>
): RealFlows {
  return useMemo(
    () => computeRealFlows(transactions, month, partialConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, month.getTime(), JSON.stringify(partialConfig)]
  );
}
