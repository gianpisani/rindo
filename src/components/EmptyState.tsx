import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Lo que se ve cuando una lista está vacía, en toda la app: una línea
 * apagada, centrada, y como mucho una acción. Lo que carga no usa esto:
 * usa Skeleton con la forma de lo que viene.
 */
export function EmptyState({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground",
        className
      )}
    >
      <p>{children}</p>
      {action && (
        <Button variant="ghost" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
