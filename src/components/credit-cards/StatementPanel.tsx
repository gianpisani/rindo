import { ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatementRow } from "@/components/credit-cards/StatementRow";
import type { InlineEdit } from "@/hooks/useInlineEdit";
import type { Transaction } from "@/hooks/useTransactions";
import type { labeledCycle } from "@/lib/card-view";
import { clp, shortDay } from "@/lib/format";
import { cn } from "@/lib/utils";

interface StatementPanelProps {
  cardName?: string;
  cycle: ReturnType<typeof labeledCycle> | null;
  statement: { txs: Transaction[]; total: number };
  cycleOffset: number;
  onOffsetChange: (offset: number) => void;
  edit: InlineEdit;
  isPrivacyMode: boolean;
}

export function StatementPanel({ cardName, cycle, statement, cycleOffset, onOffsetChange, edit, isPrivacyMode }: StatementPanelProps) {
  return (
    <section className="tj-card tj-cuenta">
      <div className="tj-card-head">
        <h2 className="tj-label">
          Estado de cuenta
          {cardName && <small> · {cardName}</small>}
        </h2>
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
          <b className={cn(isPrivacyMode && "privacy-blur")}>{clp(statement.total)}</b>
          <span>
            {shortDay(cycle.start)} → {shortDay(cycle.end)}
            {statement.txs.length > 0 && ` · ${statement.txs.length} ${statement.txs.length === 1 ? "movimiento" : "movimientos"}`}
          </span>
        </div>
      )}
      <div className="tj-list" data-scrollable>
        {statement.txs.length === 0 ? (
          <EmptyState>Sin movimientos en este ciclo</EmptyState>
        ) : (
          statement.txs.map((tx) => <StatementRow key={tx.id} tx={tx} edit={edit} isPrivacyMode={isPrivacyMode} />)
        )}
      </div>
    </section>
  );
}
