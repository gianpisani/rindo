import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Pencil } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalInput } from "@/components/meta/GoalInput";
import { CurrentSavingsCard } from "@/components/meta/CurrentSavingsCard";
import { MetaTabs, type MetaTab } from "@/components/meta/MetaTabs";
import { SavingsHistoryCard } from "@/components/meta/SavingsHistoryCard";
import { LimitsCard } from "@/components/meta/LimitsCard";
import { useSavingsGoal } from "@/hooks/useSavingsGoal";
import { useGoalDraft } from "@/hooks/useGoalDraft";
import { useLimitUsage } from "@/hooks/useLimitUsage";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { cn } from "@/lib/utils";
import { clp } from "@/lib/format";

export default function Meta() {
  const savings = useSavingsGoal();
  const { goal, hasGoal, loading } = savings;
  const goalDraft = useGoalDraft(goal, hasGoal, savings.saveGoal);
  const limits = useLimitUsage(savings.transactions, savings.todayInPeriod);
  const { isPrivacyMode } = usePrivacyMode();

  const location = useLocation();
  const [mobileTab, setMobileTab] = useState<MetaTab>(
    (location.state as { tab?: string } | null)?.tab === "limits" ? "limits" : "months"
  );

  return (
    <Layout fit>
      <div className="meta">
        <header className="meta-head">
          <h1 className="meta-title">Meta</h1>
          {loading ? (
            <Skeleton className="h-6 w-48" />
          ) : hasGoal && !goalDraft.editing ? (
            <button className="meta-goal" onClick={goalDraft.startEditing} aria-label="Editar meta">
              Ahorrar <b className={cn(isPrivacyMode && "privacy-blur")}>{clp(goal)}</b> al mes
              <Pencil />
            </button>
          ) : hasGoal ? (
            <GoalInput goal={goalDraft} autoFocus cancellable />
          ) : null}
        </header>

        {loading ? (
          <div className="meta-grid">
            <Skeleton className="meta-card h-[150px]" />
            <Skeleton className="meta-card h-[150px]" />
            <Skeleton className="meta-card h-[150px]" />
          </div>
        ) : !hasGoal ? (
          <section className="meta-card meta-setup">
            <h2>¿Cuánto quieres ahorrar al mes?</h2>
            <p>Un solo número. Cada mes verás si lo cumpliste con lo que de verdad moviste a inversión.</p>
            <GoalInput goal={goalDraft} autoFocus={false} cancellable={false} />
          </section>
        ) : (
          <div className="meta-grid" data-tab={mobileTab}>
            <CurrentSavingsCard
              current={savings.current}
              tone={savings.currentTone}
              goal={goal}
              note={savings.note}
              period={savings.period}
              today={savings.today}
            />
            <MetaTabs tab={mobileTab} onTab={setMobileTab} anyOver={limits.anyOver} />
            <SavingsHistoryCard
              months={savings.months}
              current={savings.current}
              metCount={savings.metCount}
              goal={goal}
              todayInPeriod={savings.todayInPeriod}
              startDay={savings.period.startDay}
            />
            <LimitsCard rows={limits.rows} total={limits.total} />
          </div>
        )}
      </div>
    </Layout>
  );
}
