import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useTransactions } from "@/hooks/useTransactions";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import { useCategories } from "@/hooks/useCategories";
import { useHomeMonth } from "@/hooks/useHomeMonth";
import { useRecentFeed } from "@/hooks/useRecentFeed";
import { BankSyncModal } from "@/components/bank-sync/BankSyncModal";
import { useBankSyncContext } from "@/hooks/useBankSyncContext";
import { TxSheet, type TxSheetData } from "@/components/finanzas/TxSheet";
import { MonthPulse } from "@/components/home/MonthPulse";
import { HomeHeader } from "@/components/home/HomeHeader";
import { MoneyCard } from "@/components/home/MoneyCard";
import { SpendCard } from "@/components/home/SpendCard";
import { RecentFeed } from "@/components/home/RecentFeed";
import { OverLimitsList } from "@/components/home/OverLimitsList";
import { FeedPanel, type HomeTab } from "@/components/home/FeedPanel";

const Index = () => {
  const { transactions, isLoading } = useTransactions();
  const edit = useInlineEdit();
  const { categories } = useCategories();
  const navigate = useNavigate();
  const bankSync = useBankSyncContext();
  const [storyOpen, setStoryOpen] = useState(false);
  const [isBankSyncOpen, setIsBankSyncOpen] = useState(false);
  const [sheet, setSheet] = useState<TxSheetData | null>(null);
  const [mobileTab, setMobileTab] = useState<HomeTab>("feed");

  const month = useHomeMonth(transactions);
  const feed = useRecentFeed(transactions, isLoading, edit.categoryOptions);

  const openCategory = (category: string) =>
    setSheet({
      title: category,
      icon: edit.emojiOf(category),
      color: edit.colorOf(category),
      ...month.categoryDetail(category),
      groupBy: "day",
    });

  const reviewSheet: TxSheetData | null = feed.isReviewing ? {
    title: "Por revisar",
    summary: `${feed.toReview.length} sin categoría · toca el ícono para elegirla`,
    transactions: feed.toReview,
    groupBy: "month",
  } : null;

  const seeAllLimits = () => navigate("/budget", { state: { tab: "limits" } });
  const limitsList = (
    <OverLimitsList
      hasLimits={month.hasLimits}
      overLimits={month.overLimits}
      edit={edit}
      onOpenCategory={openCategory}
      onSeeAll={seeAllLimits}
    />
  );

  return (
    <Layout fit>
      <div className="inicio">
        <div className="inicio-grid" data-tab={mobileTab}>
          <HomeHeader sweepAlert={month.sweepAlert} lastMonthName={month.lastMonthName} onSync={() => setIsBankSyncOpen(true)} />

          <MoneyCard
            period={month.period}
            thisPeriod={month.thisPeriod}
            monthExpenses={month.monthExpenses}
            pace={month.monthPace}
            hasPace={month.hasPace}
            flows={month.currentFlows}
            onOpenPace={() => setStoryOpen(true)}
          />

          <SpendCard
            breakdown={month.spendBreakdown}
            monthExpenses={month.monthExpenses}
            edit={edit}
            onOpenCategory={openCategory}
          />

          <FeedPanel
            tab={mobileTab}
            onTab={setMobileTab}
            recentCount={feed.recentCount}
            overCount={month.overLimits.length}
            hasLimits={month.hasLimits}
            onSeeAllLimits={seeAllLimits}
            feed={<RecentFeed isLoading={isLoading} feed={feed} edit={edit} />}
            limits={limitsList}
          />

          <aside className="inicio-card inicio-limits">
            <div className="inicio-panel-head">
              <span className="inicio-title">Límites pasados</span>
              {month.hasLimits && <button onClick={seeAllLimits}>Ver todos →</button>}
            </div>
            <div className="inicio-scroll">{limitsList}</div>
          </aside>
        </div>

        <BankSyncModal
          open={isBankSyncOpen}
          onOpenChange={setIsBankSyncOpen}
          syncStep={bankSync.step}
          pollStatus={bankSync.pollStatus}
          result={bankSync.result}
          onStart={bankSync.startSync}
          onStartStored={bankSync.startSyncStored}
          onImportSkipped={bankSync.importSkipped}
          onDeleteImported={bankSync.deleteImported}
          onReset={bankSync.reset}
        />
      </div>

      <TxSheet data={reviewSheet ?? sheet} edit={edit} onClose={() => { setSheet(null); feed.stopReview(); }} />

      <MonthPulse
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        initialMonth={month.thisPeriod}
        transactions={transactions}
        categories={categories}
        flowConfig={month.flowConfig}
      />
    </Layout>
  );
};

export default Index;
