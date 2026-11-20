import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { InstallmentRow } from "@/components/credit-cards/InstallmentRow";
import type { InstallmentPurchase } from "@/hooks/useInstallments";
import type { installmentsOverview } from "@/lib/card-view";
import { clp } from "@/lib/format";
import { cn } from "@/lib/utils";

interface InstallmentsPanelProps {
  overview: ReturnType<typeof installmentsOverview<InstallmentPurchase>>;
  showCard: boolean;
  isPrivacyMode: boolean;
  onAdd: () => void;
  onEdit: (installment: InstallmentPurchase) => void;
  onDelete: (id: string) => void;
}

export function InstallmentsPanel({ overview: { rows, monthlyPayment }, showCard, isPrivacyMode, onAdd, onEdit, onDelete }: InstallmentsPanelProps) {
  const [openInstallment, setOpenInstallment] = useState<string | null>(null);

  return (
    <section className="tj-card tj-cuotas">
      <div className="tj-card-head">
        <h2 className="tj-label">
          Cuotas
          {monthlyPayment > 0 && (
            <span className="tj-label-sum">
              <b className={cn(isPrivacyMode && "privacy-blur")}>{clp(monthlyPayment)}</b> al mes
            </span>
          )}
        </h2>
        <Button variant="ghost" size="sm" onClick={onAdd}>
          <Plus /> Compra
        </Button>
      </div>
      <div className="tj-list" data-scrollable>
        {rows.length === 0 ? (
          <EmptyState>Ninguna compra en cuotas</EmptyState>
        ) : (
          rows.map(({ installment: inst, progress }) => (
            <InstallmentRow
              key={inst.id}
              installment={inst}
              progress={progress}
              showCard={showCard}
              open={openInstallment === inst.id}
              isPrivacyMode={isPrivacyMode}
              onToggle={() => setOpenInstallment(openInstallment === inst.id ? null : inst.id)}
              onEdit={() => onEdit(inst)}
              onDelete={() => onDelete(inst.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}
