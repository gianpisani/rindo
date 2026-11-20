import type { CSSProperties } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CreditCardSummary } from "@/hooks/useCreditCards";
import type { CardStatus } from "@/lib/card-cycle";
import { inkOn } from "@/lib/category-color";
import { clp, shortDay } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CardPlasticProps {
  card: CreditCardSummary;
  cycle: CardStatus;
  selected: boolean;
  isPrivacyMode: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function CardPlastic({ card, cycle, selected, isPrivacyMode, onSelect, onEdit, onDelete }: CardPlasticProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="tj-plastic"
      data-selected={selected || undefined}
      style={{ "--tj-c": card.color || "var(--tj-fallback)", "--tj-ink": inkOn(card.color) } as CSSProperties}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={selected}
      aria-label={`${card.name}, por facturar ${clp(cycle.porFacturar)}${
        cycle.showAPagar ? `, a pagar ${clp(cycle.aPagar)} el ${shortDay(cycle.payDate)}` : ""
      }`}
    >
      <div className="tj-pl-top">
        <span className="tj-pl-name">{card.name}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="tj-pl-menu" aria-label={`Opciones de ${card.name}`} onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="tj-pl-mid">
        <span className="tj-pl-label">por facturar</span>
        <span className={cn("tj-pl-big", isPrivacyMode && "privacy-blur")}>{clp(cycle.porFacturar)}</span>
        <span className="tj-pl-of">
          <span>cierra el {shortDay(cycle.closes)}</span>
          {cycle.showAPagar ? (
            <span>
              a pagar <b className={cn(isPrivacyMode && "privacy-blur")}>{clp(cycle.aPagar)}</b> el {shortDay(cycle.payDate)}
            </span>
          ) : (
            <span>pagas el {shortDay(cycle.nextPay)}</span>
          )}
        </span>
      </div>

      <div className="tj-pl-bot">
        <span className={cn(isPrivacyMode && "privacy-blur")}>disponible {clp(card.available_credit)}</span>
        <span>{card.last_4_digits ? `···· ${card.last_4_digits}` : ""}</span>
      </div>
    </div>
  );
}
