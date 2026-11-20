import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CardPlastic } from "@/components/credit-cards/CardPlastic";
import { InstallmentsPanel } from "@/components/credit-cards/InstallmentsPanel";
import { StatementPanel } from "@/components/credit-cards/StatementPanel";
import { CardEditorDialogs } from "@/components/credit-cards/CardEditorDialogs";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useInstallments } from "@/hooks/useInstallments";
import { useTransactions } from "@/hooks/useTransactions";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useCardStatement } from "@/hooks/useCardStatement";
import { useCardEditors } from "@/hooks/useCardEditors";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import { installmentsOverview } from "@/lib/card-view";

export default function CreditCards() {
  const { isPrivacyMode } = usePrivacyMode();
  const cards = useCreditCards();
  const purchases = useInstallments();
  const { transactions } = useTransactions();
  const { cardSummaries } = cards;
  const edit = useInlineEdit();

  const loading = cards.isLoading || purchases.isLoading;
  const hasCards = cardSummaries.length > 0;
  const manyCards = cardSummaries.length > 1;

  const statement = useCardStatement(cardSummaries, transactions);
  const editors = useCardEditors(cards, purchases, statement.forgetCard);
  const { selected } = statement;

  const installments = useMemo(() => installmentsOverview(purchases.installments), [purchases.installments]);
  const hasActiveInstallments = installments.monthlyPayment > 0;

  const [mobileTab, setMobileTab] = useState<"cuotas" | "cuenta" | null>(null);
  const tab = mobileTab ?? (hasActiveInstallments ? "cuotas" : "cuenta");

  return (
    <Layout fit>
      <div className="tj">
        <header className="tj-head">
          <h1 className="tj-title">Tarjetas</h1>
          {hasCards && (
            <Button variant="ghost" size="sm" onClick={editors.openNewCard}>
              <Plus /> Tarjeta
            </Button>
          )}
        </header>

        {loading ? (
          <div className="tj-grid" data-tab="cuenta" aria-busy>
            <div className="tj-wallet">
              <Skeleton className="tj-plastic" />
            </div>
            <Skeleton className="tj-card tj-cuotas tj-cuotas-skeleton" />
            <div className="tj-card tj-cuenta">
              <div className="tj-card-head">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="tj-cycle">
                <Skeleton className="h-6 w-36" />
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="tj-tx">
                  <Skeleton className="size-[30px] rounded-full" />
                  <div className="body space-y-1">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        ) : !hasCards ? (
          <section className="tj-card tj-setup">
            <h2>Tu primera tarjeta</h2>
            <p>Verás cuánto llevas en el ciclo, cuándo cierra y cuándo pagas.</p>
            <Button onClick={editors.openNewCard}>
              <Plus /> Agregar tarjeta
            </Button>
          </section>
        ) : (
          <div className="tj-grid" data-tab={tab}>
            <section className="tj-wallet" data-many={manyCards || undefined} aria-label="Mis tarjetas">
              {cardSummaries.map((card) => (
                <CardPlastic
                  key={card.id}
                  card={card}
                  cycle={statement.cardCycles.get(card.id)!}
                  selected={manyCards && card.id === selected?.id}
                  isPrivacyMode={isPrivacyMode}
                  onSelect={() => statement.selectCard(card.id)}
                  onEdit={() => editors.openEditCard(card.id)}
                  onDelete={() => editors.askDelete("card", card.id)}
                />
              ))}
            </section>

            <div className="tj-tabs" role="tablist">
              <button className="tj-tab" role="tab" aria-selected={tab === "cuotas"} onClick={() => setMobileTab("cuotas")}>
                Cuotas
              </button>
              <button className="tj-tab" role="tab" aria-selected={tab === "cuenta"} onClick={() => setMobileTab("cuenta")}>
                Estado de cuenta
              </button>
            </div>

            <InstallmentsPanel
              overview={installments}
              showCard={manyCards}
              isPrivacyMode={isPrivacyMode}
              onAdd={() => editors.openInstallmentModal(null)}
              onEdit={editors.openInstallmentModal}
              onDelete={(id) => editors.askDelete("installment", id)}
            />

            <StatementPanel
              cardName={manyCards ? selected?.name : undefined}
              cycle={statement.cycle}
              statement={statement.statement}
              cycleOffset={statement.cycleOffset}
              onOffsetChange={statement.setCycleOffset}
              edit={edit}
              isPrivacyMode={isPrivacyMode}
            />
          </div>
        )}
      </div>

      <CardEditorDialogs editors={editors} />
    </Layout>
  );
}
