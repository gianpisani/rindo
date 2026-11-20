import { useMemo, useState } from "react";
import type { CreditCardSummary } from "@/hooks/useCreditCards";
import type { Transaction } from "@/hooks/useTransactions";
import { cardStatus, cycleStatement } from "@/lib/card-cycle";
import { labeledCycle } from "@/lib/card-view";

export function useCardStatement(cardSummaries: CreditCardSummary[], transactions: Transaction[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cycleOffset, setCycleOffset] = useState(0);
  const selected = cardSummaries.find((c) => c.id === selectedId) ?? cardSummaries[0];

  const cardCycles = useMemo(
    () => new Map(cardSummaries.map((card) => [card.id, cardStatus(transactions, card)] as const)),
    [cardSummaries, transactions]
  );

  const cycle = useMemo(
    () => (selected ? labeledCycle(selected.billing_day, cycleOffset) : null),
    [selected, cycleOffset]
  );
  const statement = useMemo(
    () => (selected && cycle ? cycleStatement(transactions, selected.id, cycle) : { txs: [], total: 0 }),
    [transactions, selected, cycle]
  );

  const selectCard = (id: string) => {
    setSelectedId(id);
    setCycleOffset(0);
  };
  const forgetCard = (id: string) => {
    if (selectedId === id) setSelectedId(null);
  };

  return { selected, cardCycles, cycle, statement, cycleOffset, setCycleOffset, selectCard, forgetCard };
}
