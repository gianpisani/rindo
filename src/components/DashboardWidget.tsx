import { ReactNode } from "react";
import { GlassCard } from "./GlassCard";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DashboardWidgetProps {
  children: ReactNode;
  title?: string;
  icon?: LucideIcon;
  className?: string;
  tooltip?: string;
  loading?: boolean;
}

export function DashboardWidget({ children, title, icon: Icon, className, tooltip, loading }: DashboardWidgetProps) {
  return (
    <GlassCard className={cn("h-full flex flex-col", className)}>
      {title && (
        <div className="drag-handle flex items-center gap-2 px-6 pt-5 pb-2 cursor-move border-b border-border/20 hover:border-border/40 transition-colors group">
          {Icon && (
            <Icon className="h-3.5 w-3.5 text-primary/60" />
          )}
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </h3>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
      <div className={cn("flex-1 overflow-auto", title ? "p-6 pt-4" : "p-6")}>
        {loading ? <DashboardWidgetSkeleton /> : children}
      </div>
    </GlassCard>
  );
}

function DashboardWidgetSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

/** Standalone skeleton for chart-type widgets */
export function ChartWidgetSkeleton() {
  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex items-end gap-2 h-[200px]">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}
