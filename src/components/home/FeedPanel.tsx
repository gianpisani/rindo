import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useHorizontalSwipe } from "@/hooks/useHorizontalSwipe";

export type HomeTab = "feed" | "limits";

interface FeedPanelProps {
  tab: HomeTab;
  onTab: (tab: HomeTab) => void;
  recentCount: number;
  overCount: number;
  hasLimits: boolean;
  onSeeAllLimits: () => void;
  feed: ReactNode;
  limits: ReactNode;
}

function RecentTitle({ count }: { count: number }) {
  return <>Recientes{count > 0 && <span className="inicio-count">{count}</span>}</>;
}

export function FeedPanel({ tab, onTab, recentCount, overCount, hasLimits, onSeeAllLimits, feed, limits }: FeedPanelProps) {
  const navigate = useNavigate();
  const swipe = useHorizontalSwipe((direction) => onTab(direction === "left" ? "limits" : "feed"));

  return (
    <section className="inicio-card inicio-feed" {...swipe}>
      <div className="inicio-tabs" role="tablist">
        <button className="inicio-tab" role="tab" aria-selected={tab === "feed"} onClick={() => onTab("feed")}>
          <RecentTitle count={recentCount} />
        </button>
        <button className="inicio-tab" role="tab" aria-selected={tab === "limits"} onClick={() => onTab("limits")}>
          Límites{overCount > 0 && <span className="inicio-pill">{overCount}</span>}
        </button>
      </div>
      <div className="inicio-panel-head">
        <span className="inicio-title">
          <RecentTitle count={recentCount} />
        </span>
        <button onClick={() => navigate("/transactions")}>Ver todo →</button>
      </div>
      <div className="inicio-scroll inicio-list-feed">{feed}</div>
      <div className="inicio-scroll inicio-list-limits">
        {limits}
        {hasLimits && <button className="inicio-more inicio-see-all" onClick={onSeeAllLimits}>Ver todos →</button>}
      </div>
    </section>
  );
}
