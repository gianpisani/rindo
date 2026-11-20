import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { TransactionsToolbar } from "@/components/transactions/TransactionsToolbar";
import { TxEditor } from "@/components/transactions/TxEditor";
import { DeleteTransactionsConfirm } from "@/components/transactions/DeleteTransactionsConfirm";
import { BankSyncModal } from "@/components/bank-sync/BankSyncModal";
import type { DateRangeValue } from "@/components/transactions/DateRangeFilter";
import { useBankSyncContext } from "@/hooks/useBankSyncContext";
import { useGlobalDrawers } from "@/hooks/useGlobalDrawers";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { useEditHistory } from "@/hooks/useEditHistory";
import { useSearchFocusShortcut } from "@/hooks/useSearchFocusShortcut";
import { useCategories } from "@/hooks/useCategories";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useTxEditor } from "@/hooks/useTxEditor";
import { useGhostClickGuard } from "@/hooks/useGhostClickGuard";
import { categoriesInUse } from "@/lib/category-icon";
import { exportTransactionsCsv } from "@/lib/csv-export";

const EDIT_GHOST_CLICK_MS = 800;

export default function Transactions() {
  const { transactions, futureTransactions } = useTransactions();
  const history = useEditHistory();
  const { categories } = useCategories();
  const { creditCards, isLoading: isLoadingCards } = useCreditCards();
  const bankSync = useBankSyncContext();
  const editor = useTxEditor();
  const editGhostGuard = useGhostClickGuard(EDIT_GHOST_CLICK_MS);

  const [showFuture, setShowFuture] = useState(false);
  const [isBankSyncOpen, setIsBankSyncOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [pageSize, setPageSize] = useState(100);
  const [searchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchFocusShortcut(searchInputRef);
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cardFilter, setCardFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>({});
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [bulkDelete, setBulkDelete] = useState(false);

  const visibleTransactions = showFuture ? [...transactions, ...futureTransactions] : transactions;
  const toolbarCategories = useMemo(
    () => categoriesInUse([...transactions, ...(showFuture ? futureTransactions : [])], categories),
    [transactions, futureTransactions, showFuture, categories]
  );

  const editUnlessGhostClick = (transaction: Transaction) => {
    if (editGhostGuard.isArmed()) return;
    if (deleteIds.length > 0) return;
    editor.open(transaction);
  };

  const askDelete = (ids: string[], bulk: boolean) => {
    editGhostGuard.arm();
    setBulkDelete(bulk);
    setDeleteIds(ids);
  };

  const closeDeleteConfirm = () => {
    editGhostGuard.arm();
    setDeleteIds([]);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium">Movimientos</h1>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => useGlobalDrawers.getState().openQuickAdd("Gasto")} aria-label="Agregar movimiento">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Agregar</span>
          </Button>
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

        <TransactionsToolbar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchRef={searchInputRef}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          cardFilter={cardFilter}
          onCardFilterChange={setCardFilter}
          cards={creditCards.map((card) => ({
            id: card.id,
            label: `${card.name}${card.last_4_digits ? ` ···${card.last_4_digits}` : ""}`,
          }))}
          cardsLoading={isLoadingCards}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          categories={toolbarCategories}
          futureCount={futureTransactions.length}
          showFuture={showFuture}
          onToggleFuture={() => setShowFuture(!showFuture)}
          isSyncing={bankSync.isRunning}
          onSync={() => setIsBankSyncOpen(true)}
          onExport={() => exportTransactionsCsv(transactions)}
          selecting={selecting}
          onSelectingChange={setSelecting}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />

        <TransactionsTable
          transactions={visibleTransactions}
          categories={categories}
          onEdit={editUnlessGhostClick}
          onDelete={(id) => askDelete([id], false)}
          onUpdateSilent={(id, updates) => history.update([id], updates)}
          onDeleteMultiple={(ids) => askDelete(ids, true)}
          onUpdateMultiple={history.update}
          onDuplicate={history.duplicate}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          cardFilter={cardFilter}
          onCardFilterChange={setCardFilter}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          selecting={selecting}
          onSelectingChange={setSelecting}
          pageSize={pageSize}
        />
      </div>

      <TxEditor editor={editor} />

      <DeleteTransactionsConfirm
        ids={deleteIds}
        bulk={bulkDelete}
        transactions={transactions}
        onClose={closeDeleteConfirm}
        onConfirm={history.remove}
      />
    </Layout>
  );
}
