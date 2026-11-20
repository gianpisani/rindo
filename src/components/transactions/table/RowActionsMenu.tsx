import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RowActionsMenuProps {
  variant: "table" | "card";
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenChange?: (open: boolean) => void;
}

export function RowActionsMenu({ variant, onEdit, onDuplicate, onDelete, onOpenChange }: RowActionsMenuProps) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {variant === "table" ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-9 opacity-40 hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
            aria-label="Opciones del movimiento"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        ) : (
          <button className="mobile-tx-actions-btn" onClick={(e) => e.stopPropagation()} aria-label="Opciones del movimiento">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
