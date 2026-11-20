import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import type { InlineEdit } from "@/hooks/useInlineEdit";
import type { useRecentFeed } from "@/hooks/useRecentFeed";
import { TxRow } from "@/components/transactions/TxRow";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { dayLabel, daySpend } from "@/lib/home-summary";
import { clp } from "@/lib/format";
import { cn } from "@/lib/utils";

interface RecentFeedProps {
  isLoading: boolean;
  feed: ReturnType<typeof useRecentFeed>;
  edit: InlineEdit;
}

function RecentFeedSkeleton() {
  return (
    <div className="space-y-3 px-4 py-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-[30px] rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function RecentFeed({ isLoading, feed, edit }: RecentFeedProps) {
  const { isPrivacyMode } = usePrivacyMode();
  const { live, byDay } = feed;

  if (isLoading) return <RecentFeedSkeleton />;
  if (feed.recentCount === 0) {
    return <EmptyState className="h-full">No hay movimientos aún: sincroniza tu banco y aparecen acá</EmptyState>;
  }

  return (
    <>
      {feed.toReview.length > 0 && (
        <button className="inicio-review" onClick={feed.startReview}>
          <b>{feed.toReview.length}</b> por revisar →
        </button>
      )}
      {feed.dayKeys.map((dateKey) => {
        const spent = daySpend(byDay[dateKey]);
        return (
          <div key={dateKey}>
            <div className="inicio-day">
              {dayLabel(dateKey)}
              {spent > 0 && (
                <span className={cn(isPrivacyMode && "privacy-blur")}>−{clp(spent)}</span>
              )}
            </div>
            {byDay[dateKey].map((t) => {
              const key = live.keyOf(t);
              return (
                <TxRow
                  key={key}
                  t={t}
                  edit={edit}
                  className={cn(live.entered.has(key) && "is-new", live.resolved.has(key) && "is-resolved")}
                />
              );
            })}
          </div>
        );
      })}
    </>
  );
}
