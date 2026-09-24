import { LoaderCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

export function AnalyzingBadge({ saving = false }: { saving?: boolean }) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex">
              <div role="status" className="flex items-center gap-2 py-1 text-muted-foreground">
                <LoaderCircle aria-hidden="true" className="h-3 w-3 animate-spin motion-reduce:animate-none" />
                <span className="text-xs">{saving ? 'Guardando…' : 'Categorizando…'}</span>
              </div>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-xs bg-card border border-border/50 shadow-lg"
        >
          <div className="space-y-2 p-2">
            <p className="font-semibold text-sm text-foreground">
              Categorización automática
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {saving ? 'Guardando tu movimiento. Puedes seguir usando Rindo.' : 'Eligiendo una categoría con tu historial como referencia.'}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
