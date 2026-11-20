import { format } from "date-fns";
import { es } from "date-fns/locale";
import NumberFlow from "@number-flow/react";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import type { PeriodConfig } from "@/hooks/usePeriodConfig";
import { cn } from "@/lib/utils";
import { clp } from "@/lib/format";
import type { SavingsMonth } from "@/lib/savings-goal";
import { goalProgressPct, type SavingsNote, type SavingsTone } from "@/lib/savings-goal-summary";

export function CurrentSavingsCard({
  current,
  tone,
  goal,
  note,
  period,
  today,
}: {
  current: SavingsMonth;
  tone: SavingsTone;
  goal: number;
  note: SavingsNote;
  period: PeriodConfig;
  today: Date;
}) {
  const { isPrivacyMode } = usePrivacyMode();
  const pct = goalProgressPct(current.saved, goal);

  return (
    <section className="meta-card meta-now" data-tone={tone}>
      <span className="meta-month">
        {period.isCalendar ? format(today, "MMMM yyyy", { locale: es }) : period.rangeLabel(period.currentPeriod)}
      </span>
      <div className={cn("meta-big", isPrivacyMode && "privacy-blur")}>
        $<NumberFlow
          value={current.saved}
          format={{ style: "decimal", maximumFractionDigits: 0 }}
          locales="es-CL"
        />
      </div>
      <div className={cn("meta-of", isPrivacyMode && "privacy-blur")}>de {clp(goal)}</div>
      <div className="meta-track" aria-hidden>
        <i style={{ width: `${Math.max(pct, current.saved > 0 ? 1.5 : 0)}%` }} />
      </div>
      <p className={cn("meta-note", isPrivacyMode && "privacy-blur")} data-tone={note.tone}>
        {note.text}
      </p>
    </section>
  );
}
