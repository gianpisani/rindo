import { Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UNDO_SHORTCUTS, useEditHistory, useNextEdits } from "@/hooks/useEditHistory";
import { useIsMobile } from "@/hooks/useIsMobile";

interface HistoryButtonProps {
  verb: "Deshacer" | "Rehacer";
  label: string | undefined;
  shortcut: string | null;
  icon: typeof Undo2;
  onClick: () => void;
}

function HistoryButton({ verb, label, shortcut, icon: Icon, onClick }: HistoryButtonProps) {
  const description = label
    ? [`${verb}: ${label}`, shortcut].filter(Boolean).join(" · ")
    : `Nada que ${verb.toLowerCase()}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={description}
            disabled={!label}
            onClick={onClick}
          >
            <Icon />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  );
}

export function UndoRedoControls() {
  const { undo, redo } = useEditHistory();
  const { undoLabel, redoLabel } = useNextEdits();
  const isMobile = useIsMobile();

  if (!undoLabel && !redoLabel) return null;

  return (
    <div className="flex items-center animate-in fade-in-0" role="group" aria-label="Historial de cambios">
      <HistoryButton verb="Deshacer" label={undoLabel} shortcut={isMobile ? null : UNDO_SHORTCUTS.undo} icon={Undo2} onClick={undo} />
      <HistoryButton verb="Rehacer" label={redoLabel} shortcut={isMobile ? null : UNDO_SHORTCUTS.redo} icon={Redo2} onClick={redo} />
    </div>
  );
}
