import { Badge } from "./ui/badge";
import { Cpu, Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { FingerPrintIcon } from "@heroicons/react/24/outline";

export function AnalyzingBadge() {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex">
            <Badge 
              variant="outline" 
            >
              <div className="z-10 flex items-center gap-1.5 animate-pulse">
                <Cpu className="h-4 w-4 text-violet" />
                <span className="text-xs font-semibold tracking-wide">Analizando...</span>
              </div>
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-xs bg-card border border-border shadow-lg"
        >
          <div className="space-y-2 p-2">
            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
              Categorización automática
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Estamos analizando tu transacción. Si encontramos una categoría que coincida, la aplicaremos automáticamente.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

