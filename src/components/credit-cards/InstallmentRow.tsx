import type { CSSProperties } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InstallmentPurchase } from "@/hooks/useInstallments";
import { clp, shortMonthYear } from "@/lib/format";
import type { installmentProgress } from "@/lib/installments";
import { cn } from "@/lib/utils";

interface InstallmentRowProps {
  installment: InstallmentPurchase;
  progress: ReturnType<typeof installmentProgress>;
  showCard: boolean;
  open: boolean;
  isPrivacyMode: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function InstallmentRow({
  installment,
  progress: { billed, left, last, active },
  showCard,
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
      <button
        className="tj-inst-main"
        style={{ "--tj-c": installment.card_color || "var(--tj-fallback)" } as CSSProperties}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="n">{installment.description}</span>
        <span className={cn("v", isPrivacyMode && "privacy-blur")}>
          {clp(installment.installment_amount)}
          <small>/mes</small>
        </span>
        <span className="tj-inst-track" aria-hidden>
          <i style={{ width: `${(billed / total) * 100}%` }} />
        </span>
        <span className="k">
          {done ? "Terminada" : `${billed} de ${total} · termina ${shortMonthYear(last)}`}
          {showCard && installment.card_name && ` · ${installment.card_name}`}
        </span>
      </button>

      {open && (
        <div className="tj-inst-detail">
          <p className={cn("tj-inst-meta", isPrivacyMode && "privacy-blur")}>
            <span>total {clp(installment.total_amount)}</span>
            {!done && <span>quedan {clp(left * installment.installment_amount)}</span>}
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
