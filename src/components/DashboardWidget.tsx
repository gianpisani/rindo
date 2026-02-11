import { ReactNode } from "react";
import { GlassCard } from "./GlassCard";
import { GripVertical, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
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
}

export function DashboardWidget({ children, title, icon: Icon, className, tooltip }: DashboardWidgetProps) {
  return (
    <GlassCard className={cn("h-full flex flex-col", className)}>
      {title && (
        <div className="drag-handle flex items-center gap-2 px-6 pt-6 pb-2 cursor-move border-b border-border/30 hover:border-border/60 transition-colors group">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          <h3 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
            {title}
          </h3>
          {Icon && (
            <Icon className={cn("h-4 w-4 inline")} />
          )}
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
        {children}
      </div>
    </GlassCard>
  );
}
