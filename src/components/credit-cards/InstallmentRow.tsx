import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InstallmentPurchase } from "@/hooks/useInstallments";
import { shortMonthYear } from "@/lib/card-view";
import { clp } from "@/lib/format";
import type { installmentProgress } from "@/lib/installments";
import { cn } from "@/lib/utils";

interface InstallmentRowProps {
  installment: InstallmentPurchase;
  progress: ReturnType<typeof installmentProgress>;
  open: boolean;
  isPrivacyMode: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function InstallmentRow({
  installment,
  progress: { billed, left, last, active },
  open,
  isPrivacyMode,
  onToggle,
  onEdit,
  onDelete,
}: InstallmentRowProps) {
  const total = installment.total_installments;
  const done = !active;

  return (
    <div className="tj-inst" data-done={done || undefined} data-open={open || undefined}>
      <button className="tj-inst-main" onClick={onToggle} aria-expanded={open}>
        <i className="tj-dot" style={{ background: installment.card_color || "var(--tj-fallback)" }} aria-hidden />
        <span className="n">
          {installment.description}
          {installment.card_name && <small>{installment.card_name}</small>}
        </span>
        <span className={cn("v", isPrivacyMode && "privacy-blur")}>
          {clp(installment.installment_amount)}
          <small>/mes</small>
        </span>
        <span className="row2">
          <span className="tj-inst-track">
            <i style={{ width: `${(billed / total) * 100}%` }} />
          </span>
          <span className="k">{done ? "terminada" : `quedan ${left} de ${total}`}</span>
        </span>
      </button>

      {open && (
        <div className="tj-inst-detail">
          <p className={cn("tj-inst-meta", isPrivacyMode && "privacy-blur")}>
            <span>total {clp(installment.total_amount)}</span>
            {!done && <span>quedan {clp(left * installment.installment_amount)}</span>}
            <span>última {shortMonthYear(last)}</span>
          </p>
          <div className="tj-inst-actions">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil /> Editar
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}>
              <Trash2 /> Eliminar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
