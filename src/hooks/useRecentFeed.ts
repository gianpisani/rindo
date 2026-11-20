import { useEffect, useMemo, useState } from "react";
import type { Transaction } from "@/hooks/useTransactions";
import { useLiveRows } from "@/hooks/useLiveRows";
import type { InlineEdit } from "@/hooks/useInlineEdit";
import { byNewest } from "@/lib/tx-order";
import { isAnalyzing, needsReview } from "@/lib/tx-display";
import { groupByDay, newestDayFirst } from "@/lib/home-summary";

const RECENT_LIMIT = 40;

export function useRecentFeed(transactions: Transaction[], isLoading: boolean, categoryOptions: InlineEdit["categoryOptions"]) {
  const [reviewing, setReviewing] = useState(false);
  const toReview = useMemo(
    () => transactions.filter((t) => needsReview(t) && categoryOptions(t.type).length > 0),
    [transactions, categoryOptions]
  );
  useEffect(() => {
    if (reviewing && toReview.length === 0) setReviewing(false);
  }, [reviewing, toReview.length]);

  const recentTransactions = [...transactions]
    .sort(byNewest)
    .slice(0, RECENT_LIMIT);

  const live = useLiveRows(recentTransactions, !isLoading, isAnalyzing);
  const byDay = groupByDay(live.visible);
  const dayKeys = newestDayFirst(Object.keys(byDay));

  return {
    recentCount: recentTransactions.length,
    live,
    byDay,
    dayKeys,
    toReview,
    isReviewing: reviewing && toReview.length > 0,
    startReview: () => setReviewing(true),
    stopReview: () => setReviewing(false),
  };
}
