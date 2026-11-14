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

/**
 * El mes financiero del usuario, compartido por toda la analítica. Se guarda
 * en `user_profiles.period_start_day`; mientras carga se usa el calendario.
 */
export function usePeriodConfig() {
  const { profile } = useUserProfile();
  const startDay = normalizeStartDay(profile?.period_start_day);

  return useMemo(() => {
    const startOf = (date: Date) => periodStartOf(date, startDay);
    return {
      startDay,
      /** Día en que termina (0 = último día del mes). */
      endDay: periodEndDay(startDay),
      isCalendar: startDay === 1,
      currentPeriod: startOf(new Date()),
      startOf,
      endOf: (start: Date) => periodEndOf(start, startDay),
      shift: (start: Date, delta: number) => shiftPeriod(start, delta, startDay),
      /** "15 nov – 14 dic". */
      rangeLabel: (start: Date) => periodRangeLabel(start, startDay),
      /** "diciembre" para el 15 nov – 14 dic: el mes en que termina. */
      monthName: (start: Date) => periodMonthName(start, startDay),
      /** Fecha del mes que da nombre al periodo, para formatear con date-fns. */
      nameDate: (start: Date) => periodNameDate(start, startDay),
    };
  }, [startDay]);
}

export type PeriodConfig = ReturnType<typeof usePeriodConfig>;
