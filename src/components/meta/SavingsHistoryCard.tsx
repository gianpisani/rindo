import { useEffect, useState, type CSSProperties } from "react";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { cn } from "@/lib/utils";
import type { SavingsMonth } from "@/lib/savings-goal";
import {
  SAVINGS_HISTORY_MONTHS,
  periodMonthLabel,
  savingsChartScale,
  savingsMonthDetail,
  savingsTone,
} from "@/lib/savings-goal-summary";

export function SavingsHistoryCard({
  months,
  current,
  metCount,
  goal,
  todayInPeriod,
  startDay,
}: {
  months: SavingsMonth[];
  current: SavingsMonth;
  metCount: number;
  goal: number;
  todayInPeriod: number;
  startDay: number;
}) {
  const { isPrivacyMode } = usePrivacyMode();
  const [selectedKey, setSelectedKey] = useState(current.key);
  useEffect(() => setSelectedKey(current.key), [current.key]);
  const selected = months.find((m) => m.key === selectedKey) ?? current;
  const detail = savingsMonthDetail(selected, startDay);
  const { scale, goalFrac } = savingsChartScale(goal, months);

  return (
    <section className="meta-card meta-hist">
      <div className="meta-card-head">
        <span className="meta-label">Últimos {SAVINGS_HISTORY_MONTHS} meses</span>
        <span className="meta-count">
          <b>{metCount}</b> de {SAVINGS_HISTORY_MONTHS} cumplidos
        </span>
      </div>
      <div className="meta-chart" role="listbox" aria-label="Ahorro por mes">
        <i
          className="meta-goal-line"
          style={{ bottom: `calc(var(--meta-mon) + (100% - var(--meta-mon)) * ${goalFrac})` }}
          aria-hidden
        />
        {months.map((m, i) => {
          const isCurrent = m.key === current.key;
          const tone = savingsTone(m, isCurrent, todayInPeriod);
          const height = `${Math.min(100, (m.saved / scale) * 100)}%`;
          return (
            <button
              key={m.key}
              role="option"
              aria-selected={m.key === selectedKey}
              className="meta-col"
              data-tone={tone}
              onClick={() => setSelectedKey(m.key)}
              style={{ "--i": i } as CSSProperties}
            >
              <span className="meta-bar">
                <i style={{ height }} />
              </span>
              <span className="meta-mon"><span>{periodMonthLabel(m.month, startDay, "MMM")}</span></span>
            </button>
          );
        })}
      </div>
      <div className="meta-detail" data-tone={savingsTone(selected, selected.key === current.key, todayInPeriod)}>
        <p className={cn("meta-detail-top", isPrivacyMode && "privacy-blur")}>{detail.top}</p>
        <p className={cn("meta-detail-sub", isPrivacyMode && "privacy-blur")}>{detail.bottom}</p>
      </div>
    </section>
  );
}
