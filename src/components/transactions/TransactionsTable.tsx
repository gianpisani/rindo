import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  SortingState,
  Cell,
  Row,
  RowSelectionState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Transaction } from "@/hooks/useTransactions";
import { displaySign } from "@/lib/ledger";
import { getCleanDetail } from "@/lib/whisper";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { useCreditCards } from "@/hooks/useCreditCards";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useCategories } from "@/hooks/useCategories";
import { useGhostClickGuard } from "@/hooks/useGhostClickGuard";
import { CategoryComposer } from "../categories/CategoryComposer";
import { QuickCategoryPicker } from "../categories/QuickCategoryPicker";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import { ANALYZING_CATEGORY } from "@/lib/auto-category-policy";
import { formatGroupDate } from "@/lib/tx-display";
import { DEFAULT_SORT, consecutiveSections } from "@/lib/table-sort";
import { clpSigned } from "@/lib/format";
import type { DateRangeValue } from "./DateRangeFilter";
import { useTransactionColumns, type TableCategory } from "./table/useTransactionColumns";
import { MobileTxCard } from "./table/MobileTxCard";
import { SelectionPanel } from "./table/SelectionPanel";
import { useRecategorizedIds } from "./table/useRecategorizedIds";

const MENU_GHOST_CLICK_MS = 400;

const renderCellInPlace = (cell: Cell<Transaction, unknown>) => {
  const render = cell.column.columnDef.cell;
  return typeof render === "function" ? render(cell.getContext()) : render;
};

function TableEmpty({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return hasFilters ? (
    <EmptyState action={{ label: "Limpiar filtros", onClick: onClear }}>Nada con estos filtros</EmptyState>
  ) : (
    <EmptyState>Sin movimientos todavía: agrega el primero con + o la tecla N</EmptyState>
  );
}

interface TransactionsTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onUpdateSilent: (id: string, updates: Partial<Transaction>) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onUpdateMultiple: (ids: string[], updates: Partial<Pick<Transaction, "category_name" | "type">>) => void;
  onDuplicate: (ids: string[]) => void;
  categories: TableCategory[];
  searchValue: string;
  onSearchChange: (v: string) => void;
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (v: string) => void;
  cardFilter: string;
  onCardFilterChange: (v: string) => void;
  dateRange: DateRangeValue;
  onDateRangeChange: (v: DateRangeValue) => void;
  selecting: boolean;
  onSelectingChange: (v: boolean) => void;
  pageSize: number;
}

export function TransactionsTable({
  transactions,
  onEdit,
  onDelete,
  onUpdateSilent,
  onDeleteMultiple,
  onUpdateMultiple,
  onDuplicate,
  categories,
  searchValue,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  cardFilter,
  onCardFilterChange,
  dateRange,
  onDateRangeChange,
  selecting,
  onSelectingChange,
  pageSize,
}: TransactionsTableProps) {
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORT);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pageIndex, setPageIndex] = useState(0);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const { isPrivacyMode } = usePrivacyMode();
  const { creditCards, isLoading: isLoadingCards } = useCreditCards();
  const { addCategory } = useCategories();
  const isMobile = useIsMobile();
  const menuGhostGuard = useGhostClickGuard(MENU_GHOST_CLICK_MS);
  const recategorized = useRecategorizedIds(transactions);

  const [categoryDraft, setCategoryDraft] = useState<{
    transactionId: string;
    type: Transaction["type"];
    name: string;
  } | null>(null);

  const armGuardOnMenuClose = (open: boolean) => {
    if (!open) menuGhostGuard.arm();
  };
  const editUnlessMenuJustClosed = (t: Transaction) => {
    if (menuGhostGuard.isArmed()) return;
    if (!t.isPending) onEdit(t);
  };

  const hasActiveFilters =
    Boolean(searchValue) || typeFilter !== "all" || categoryFilter !== "all" || cardFilter !== "all" ||
    Boolean(dateRange.from || dateRange.to);
  const clearFilters = () => {
    onSearchChange("");
    onTypeFilterChange("all");
    onCategoryFilterChange("all");
    onCardFilterChange("all");
    onDateRangeChange({});
  };

  useEffect(() => {
    setRowSelection({});
  }, [transactions.length]);

  useEffect(() => {
    if (!selecting) setRowSelection({});
  }, [selecting]);

  useEffect(() => {
    setPageIndex(0);
  }, [pageSize, sorting]);

  const handleInlineUpdate = useCallback((id: string, field: keyof Transaction, value: unknown) => {
    if (id.startsWith("pending-")) return;
    onUpdateSilent(id, { [field]: value });
  }, [onUpdateSilent]);

  const { save: saveInline, categoryOptions } = useInlineEdit();
  const armMenuGuard = menuGhostGuard.arm;
  const withCategoryPicker = useCallback((t: Transaction, trigger: React.ReactElement) =>
    t.isPending || t.category_name === ANALYZING_CATEGORY ? trigger : (
      <QuickCategoryPicker
        value={t.category_name}
        options={categoryOptions(t.type)}
        title={getCleanDetail(t.detail) || undefined}
        onPick={(name) => saveInline(t, { category_name: name })}
        onCreate={(name) => setCategoryDraft({ transactionId: t.id, type: t.type, name })}
        onOpenChange={(open) => { if (!open) armMenuGuard(); }}
      >
        {trigger}
      </QuickCategoryPicker>
    ), [categoryOptions, saveInline, armMenuGuard]);

  const columns = useTransactionColumns({
    selecting,
    categories,
    creditCards,
    isLoadingCards,
    isPrivacyMode,
    onEdit,
    onDelete,
    onDuplicate,
    onInlineUpdate: handleInlineUpdate,
    withCategoryPicker,
    categoryOptions,
  });

  const fuzzyResults = useFuzzySearch(transactions, searchValue);

  const filteredData = useMemo(() => {
    let data = searchValue ? fuzzyResults : transactions;
    if (typeFilter !== "all") data = data.filter(t => t.type === typeFilter);
    if (categoryFilter !== "all") data = data.filter(t => t.category_name === categoryFilter);
    if (cardFilter !== "all") data = data.filter(t => (cardFilter === "none" ? !t.card_id : t.card_id === cardFilter));
    if (dateRange.from || dateRange.to) {
      data = data.filter(t => {
        const date = new Date(t.date);
        if (dateRange.from && date < dateRange.from) return false;
        if (dateRange.to && date > dateRange.to) return false;
        return true;
      });
    }
    return data;
  }, [fuzzyResults, transactions, searchValue, typeFilter, categoryFilter, cardFilter, dateRange]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) =>
      setPageIndex((typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater).pageIndex),
    state: { sorting, rowSelection, pagination: { pageIndex, pageSize } },
    enableRowSelection: row => !row.original.isPending,
    autoResetPageIndex: false,
    getRowId: (row) => row.id,
  });

  const pageRows = table.getRowModel().rows;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const hasSelection = selectedRows.length > 0;

  const handleRowMouseDown = (e: React.MouseEvent, startIdx: number) => {
    if (!selecting || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, [role="menuitem"], [role="combobox"], [role="listbox"], [data-radix-collection-item], [type="checkbox"]')) return;

    const initialSelection = { ...rowSelection };
    let currentIdx = startIdx;

    const handleMove = (ev: MouseEvent) => {
      if (!tbodyRef.current) return;
      const tr = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("tr[data-row-index]");
      const idx = tr ? parseInt(tr.getAttribute("data-row-index") || "", 10) : NaN;
      if (isNaN(idx) || idx === currentIdx) return;
      currentIdx = idx;

      const newSelection: RowSelectionState = { ...initialSelection };
      for (let i = Math.min(startIdx, idx); i <= Math.max(startIdx, idx); i++) {
        if (pageRows[i]) newSelection[pageRows[i].id] = true;
      }
      setRowSelection(newSelection);
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      document.body.style.userSelect = "";
    };

    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const filteredSum = filteredData.reduce((sum, t) => sum + displaySign(t.type) * t.amount, 0);

  const groupByDay = sorting.length === 0 || sorting[0].id === "date";

  const daySections = useMemo(() => consecutiveSections(pageRows, (row) =>
    groupByDay ? format(new Date(row.original.date), "yyyy-MM-dd") : "all"),
  [pageRows, groupByDay]);

  const timeLabel = (t: Transaction) =>
    format(new Date(t.date), groupByDay ? "HH:mm" : "d MMM HH:mm", { locale: es });

  const renderMobileCard = (row: Row<Transaction>, stamp: string) => (
    <MobileTxCard
      key={row.id}
      row={row}
      timeLabel={stamp}
      selecting={selecting}
      resolved={recategorized.has(row.id)}
      categories={categories}
      isPrivacyMode={isPrivacyMode}
      withCategoryPicker={withCategoryPicker}
      onInlineUpdate={handleInlineUpdate}
      onOpen={editUnlessMenuJustClosed}
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onMenuOpenChange={armGuardOnMenuClose}
    />
  );

  const renderDesktopRow = (row: Row<Transaction>, index: number) => {
    const isMissing = row.original.category_name === "Sin categoría";
    return (
      <tr
        key={row.id}
        data-row-index={index}
        data-transaction-id={row.original.id}
        data-state={row.getIsSelected() && "selected"}
        className={cn(
          "transition-colors",
          !row.original.isPending && "is-editable",
          recategorized.has(row.id) && "is-resolved",
          row.original.isPending && "pointer-events-none opacity-60",
          isMissing && "border-l-2 border-l-amber-400/70"
        )}
        onMouseDown={(e) => handleRowMouseDown(e, index)}
      >
        {row.getVisibleCells().map((cell) => (
          <td key={cell.id} className={cn("px-3 py-1.5 overflow-hidden", isMissing && "bg-amber-400/5")}>
            {renderCellInPlace(cell)}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <div className="space-y-4 mx-auto">
      {hasSelection && (
        <SelectionPanel
          selected={selectedRows.map(row => row.original)}
          categories={categories}
          isPrivacyMode={isPrivacyMode}
          onClearSelection={() => setRowSelection({})}
          onUpdateMultiple={onUpdateMultiple}
          onDuplicate={onDuplicate}
          onDeleteMultiple={onDeleteMultiple}
        />
      )}

      {selecting && (
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {hasSelection
              ? `${selectedRows.length} seleccionado${selectedRows.length > 1 ? "s" : ""}`
              : "Toca los movimientos para seleccionarlos"}
          </span>
          <Button variant="ghost" size="xs" onClick={() => onSelectingChange(false)}>
            Listo
          </Button>
        </div>
      )}

      {isMobile ? (
        <div className="mobile-tx-list">
          {pageRows.length === 0 ? (
            <TableEmpty hasFilters={hasActiveFilters} onClear={clearFilters} />
          ) : (
            daySections.map((section) => (
              <React.Fragment key={`${section.key}-${section.start}`}>
                {groupByDay && <div className="mobile-tx-date-header">{formatGroupDate(section.key)}</div>}
                {section.items.map((row) => renderMobileCard(row, timeLabel(row.original)))}
              </React.Fragment>
            ))
          )}
        </div>
      ) : (
        <div className="border rounded-card overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[300px]">
            <table className="w-full table-fixed">
              <thead className="bg-card border-b border-border sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        aria-sort={header.column.getIsSorted() === "asc" ? "ascending" : header.column.getIsSorted() === "desc" ? "descending" : undefined}
                        className={cn(
                          "h-9 px-3 text-left align-middle text-xs font-medium text-muted-foreground",
                          header.column.id === "amount" && "text-right"
                        )}
                        style={{
                          width: header.column.columnDef.size,
                          minWidth: header.column.columnDef.minSize,
                          maxWidth: header.column.columnDef.maxSize,
                        }}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody ref={tbodyRef} className="divide-y bg-card">
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length}>
                      <TableEmpty hasFilters={hasActiveFilters} onClear={clearFilters} />
                    </td>
                  </tr>
                ) : (
                  pageRows.map(renderDesktopRow)
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {filteredData.length} movimiento{filteredData.length === 1 ? "" : "s"}
          {filteredData.length > 0 && (
            <>
              {" · Suma "}
              <span className={cn("font-mono tabular-nums", isPrivacyMode && "privacy-blur")}>
                {clpSigned(filteredSum)}
              </span>
            </>
          )}
        </span>
        {table.getPageCount() > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="size-9"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="tabular-nums">
              {pageIndex + 1} de {table.getPageCount()}
            </span>
            <Button
              variant="ghost" size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="size-9"
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <CategoryComposer
        open={categoryDraft !== null}
        onOpenChange={(open) => !open && setCategoryDraft(null)}
        initialName={categoryDraft?.name}
        fixedType={categoryDraft?.type}
        pending={addCategory.isPending}
        onSave={async (category) => {
          if (!categoryDraft) return;
          await addCategory.mutateAsync({
            name: category.name,
            type: category.type,
            color: category.color,
            icon: category.icon,
          });
          handleInlineUpdate(categoryDraft.transactionId, "category_name", category.name);
        }}
      />
    </div>
  );
}
