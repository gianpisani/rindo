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
import { installmentsOverview } from "@/lib/card-view";

export default function CreditCards() {
  const { isPrivacyMode } = usePrivacyMode();
  const cards = useCreditCards();
  const purchases = useInstallments();
  const { transactions } = useTransactions();
  const { cardSummaries } = cards;

  const loading = cards.isLoading || purchases.isLoading;
  const hasCards = cardSummaries.length > 0;

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
          <div className="tj-grid">
            <div className="tj-wallet">
              <Skeleton className="tj-plastic" />
              <Skeleton className="tj-plastic" />
            </div>
            <Skeleton className="tj-card tj-cuotas" />
            <Skeleton className="tj-card tj-cuenta" />
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
            <section className="tj-wallet" aria-label="Mis tarjetas">
              {cardSummaries.map((card) => (
                <CardPlastic
                  key={card.id}
                  card={card}
                  cycle={statement.cardCycles.get(card.id)!}
                  selected={cardSummaries.length > 1 && card.id === selected?.id}
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
              isPrivacyMode={isPrivacyMode}
              onAdd={() => editors.openInstallmentModal(null)}
              onEdit={editors.openInstallmentModal}
              onDelete={(id) => editors.askDelete("installment", id)}
            />

            <StatementPanel
              cardName={selected && cardSummaries.length > 1 ? selected.name : undefined}
              cycle={statement.cycle}
              statement={statement.statement}
              cycleOffset={statement.cycleOffset}
              onOffsetChange={statement.setCycleOffset}
              isPrivacyMode={isPrivacyMode}
            />
          </div>
        )}
      </div>

      <CardEditorDialogs editors={editors} />
    </Layout>
  );
}
