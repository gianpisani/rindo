import { type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ShelfSectionProps {
  icon?: ReactNode;
  title: string;
  /** El numerito del encabezado: cuántas cosas hay guardadas acá. */
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Acción propia de la estantería (el "+" de la cola, por ejemplo). */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Una estantería de contenido: encabezado con su cuenta y todo lo de adentro
 * plegable. Las dos secciones de la portada —lo que dejaste a medias y lo que
 * guardaste para después— usan esta misma caja.
 */
export function ShelfSection({
  icon,
  title,
  count,
  open,
  onOpenChange,
  action,
  children,
}: ShelfSectionProps) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="rounded-2xl border border-border/60 bg-card"
    >
      <div className="flex items-center justify-between gap-2 px-5 py-4">
        <CollapsibleTrigger
          className={cn(
            "group flex min-w-0 flex-1 items-center gap-2 text-left",
            "transition-colors hover:text-foreground"
          )}
        >
          {icon}
          <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </span>

          <span
            className={cn(
              "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5",
              "text-[11px] font-bold tabular-nums transition-colors",
              open
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary"
            )}
          >
            {count}
          </span>

          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              !open && "-rotate-90"
            )}
          />
        </CollapsibleTrigger>

        {action}
      </div>

      <CollapsibleContent
        className={cn(
          "overflow-hidden",
          "data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up"
        )}
      >
        <div className="px-5 pb-5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
