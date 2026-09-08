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
    /* Ya no es una tarjeta con borde propio: es una celda de la grilla, y
       la línea que la separa de la de arriba la pone el gap del Row. */
    <Collapsible open={open} onOpenChange={onOpenChange} className="bg-card">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 md:px-5">
        <CollapsibleTrigger
          className={cn(
            "group flex min-w-0 flex-1 items-center gap-2 text-left",
            "transition-colors hover:text-foreground focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          {icon}
          <span className="section-title truncate text-xs">{title}</span>

          {/* Cerrada, la cuenta es un bloque de acento: es la única pista
              de que ahí adentro hay algo. Abierta, ya se ve. */}
          <span
            className={cn(
              "inline-flex h-4 min-w-4 shrink-0 items-center justify-center px-1",
              "font-mono text-[10px] font-bold tabular-nums transition-colors",
              open
                ? "text-muted-foreground"
                : "bg-primary text-primary-foreground"
            )}
          >
            {count}
          </span>

          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
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
        <div className="px-4 pb-4 md:px-5 md:pb-5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
