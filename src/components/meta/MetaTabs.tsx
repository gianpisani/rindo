import { SAVINGS_HISTORY_MONTHS } from "@/lib/savings-goal-summary";

export type MetaTab = "months" | "limits";

export function MetaTabs({ tab, onTab, anyOver }: { tab: MetaTab; onTab: (tab: MetaTab) => void; anyOver: boolean }) {
  return (
    <div className="meta-tabs" role="tablist">
      <button className="meta-tab" role="tab" aria-selected={tab === "months"} onClick={() => onTab("months")}>
        {SAVINGS_HISTORY_MONTHS} meses
      </button>
      <button className="meta-tab" role="tab" aria-selected={tab === "limits"} onClick={() => onTab("limits")}>
        Límites
        {anyOver && <i className="meta-dot" aria-hidden />}
      </button>
    </div>
  );
}
