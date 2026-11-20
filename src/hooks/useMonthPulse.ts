import { useCallback, useEffect, useMemo, useState } from "react";
import { periodStartOf, shiftPeriod } from "@/lib/period";
import { usePeriodConfig } from "@/hooks/usePeriodConfig";
import type { Transaction } from "@/hooks/useTransactions";
import { computeRealFlows, type RealFlowsConfig } from "@/lib/real-flows";
import { computeMonthPace, paceVerdict } from "@/lib/month-pace";
import { typicalIncome } from "@/lib/pace-chart";

interface MonthPulseInput {
  open: boolean;
  onClose: () => void;
  initialMonth: Date;
  transactions: Transaction[];
  flowConfig?: Partial<RealFlowsConfig>;
}

export function useMonthPulse({ open, onClose, initialMonth, transactions, flowConfig }: MonthPulseInput) {
  const period = usePeriodConfig();
  const startDay = flowConfig?.periodStartDay ?? period.startDay;
  const startOf = (d: Date) => periodStartOf(d, startDay);
  const shift = useCallback((m: Date, delta: number) => shiftPeriod(m, delta, startDay), [startDay]);
  const [month, setMonth] = useState(() => startOf(initialMonth));

  useEffect(() => {
    if (open) setMonth(startOf(initialMonth));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, startDay]);

  const firstMonth = useMemo(() => {
    let min = Date.now();
    for (const t of transactions) min = Math.min(min, new Date(t.date).getTime());
    return periodStartOf(new Date(min), startDay);
  }, [transactions, startDay]);
  const canBack = month > firstMonth;
  const canForward = month < startOf(new Date());

  const pace = useMemo(
    () => computeMonthPace(transactions, month, { startDay }),
    [transactions, month, startDay]
  );
  const verdict = paceVerdict(pace);

  const income = useMemo(() => {
    const cur = computeRealFlows(transactions, month, flowConfig).ingresoReal;
    if (cur > 0 || !pace.isLive) return { amount: cur, estimated: false };
    const previous = [1, 2, 3].map((b) => computeRealFlows(transactions, shift(month, -b), flowConfig).ingresoReal);
    return { amount: typicalIncome(previous), estimated: true };
  }, [transactions, month, flowConfig, pace.isLive, shift]);
  const leftover = income.amount - pace.projectedTotal;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && canBack) setMonth((m) => shift(m, -1));
      if (e.key === "ArrowRight" && canForward) setMonth((m) => shift(m, 1));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, canBack, canForward, shift]);

  const step = (delta: number) => setMonth((m) => shift(m, delta));

  return { period, startDay, month, step, canBack, canForward, pace, verdict, income, leftover };
}
