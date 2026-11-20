import { useMemo } from "react";
import { useUserProfile } from "./useUserProfile";
import {
  normalizeStartDay,
  periodEndDay,
  periodEndOf,
  periodMonthName,
  periodNameDate,
  periodRangeLabel,
  periodStartOf,
  shiftPeriod,
} from "@/lib/period";
import type { RealFlowsConfig } from "@/lib/real-flows";

export function usePeriodConfig() {
  const { profile } = useUserProfile();
  const startDay = normalizeStartDay(profile?.period_start_day);

  return useMemo(() => {
    const startOf = (date: Date) => periodStartOf(date, startDay);
    return {
      startDay,
      flowConfig: { periodStartDay: startDay } satisfies Partial<RealFlowsConfig>,
      endDay: periodEndDay(startDay),
      isCalendar: startDay === 1,
      currentPeriod: startOf(new Date()),
      startOf,
      endOf: (start: Date) => periodEndOf(start, startDay),
      shift: (start: Date, delta: number) => shiftPeriod(start, delta, startDay),
      rangeLabel: (start: Date) => periodRangeLabel(start, startDay),
      monthName: (start: Date) => periodMonthName(start, startDay),
      nameDate: (start: Date) => periodNameDate(start, startDay),
    };
  }, [startDay]);
}

export type PeriodConfig = ReturnType<typeof usePeriodConfig>;
