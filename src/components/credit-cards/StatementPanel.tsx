import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Transaction } from "@/hooks/useTransactions";
import { withoutEmoji, type labeledCycle } from "@/lib/card-view";
import { clp, shortDay } from "@/lib/format";
import { isCardPayment } from "@/lib/ledger";
import { cn } from "@/lib/utils";

interface StatementPanelProps {
  cardName?: string;
  cycle: ReturnType<typeof labeledCycle> | null;
  statement: { txs: Transaction[]; total: number };
  cycleOffset: number;
  onOffsetChange: (offset: number) => void;
  isPrivacyMode: boolean;
}

export function StatementPanel({ cardName, cycle, statement, cycleOffset, onOffsetChange, isPrivacyMode }: StatementPanelProps) {
  return (
    <section className="tj-card tj-cuenta">
      <div className="tj-card-head">
        <span className="tj-label">
          Estado de cuenta
          {cardName && <small> · {cardName}</small>}
        </span>
        <span className="tj-stepper">
          <button onClick={() => onOffsetChange(cycleOffset - 1)} aria-label="Ciclo anterior">
            <ChevronLeft />
          </button>
          <span className="label">{cycle?.label ?? "—"}</span>
          <button onClick={() => onOffsetChange(cycleOffset + 1)} disabled={cycleOffset >= 0} aria-label="Ciclo siguiente">
            <ChevronRight />
          </button>
        </span>
      </div>
      {cycle && (
        <div className="tj-cycle">
          <span>
            {shortDay(cycle.start)} → {shortDay(cycle.end)}
          </span>
          <b className={cn(isPrivacyMode && "privacy-blur")}>{clp(statement.total)}</b>
        </div>
      )}
      <div className="tj-list" data-scrollable>
        {statement.txs.length === 0 ? (
          <EmptyState>Sin movimientos en este ciclo</EmptyState>
        ) : (
          statement.txs.map((tx) => {
            const credit = tx.type === "Ingreso" || isCardPayment(tx);
            return (
              <div key={tx.id} className="tj-tx" data-in={credit || undefined}>
                <span className="d">{format(new Date(tx.date), "dd/MM")}</span>
                <span className={cn("n", isPrivacyMode && "privacy-blur")}>{withoutEmoji(tx.detail || tx.category_name)}</span>
                <span className={cn("v", isPrivacyMode && "privacy-blur")}>
                  {credit ? "+" : ""}
                  {clp(Number(tx.amount))}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
