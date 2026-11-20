import { useMemo, type ReactElement } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, CreditCard, Undo2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineDateTimePicker } from "@/components/ui/date-time-picker";
import { AnalyzingBadge } from "@/components/transactions/AnalyzingBadge";
import type { Transaction } from "@/hooks/useTransactions";
import type { CreditCard as Card } from "@/hooks/useCreditCards";
import { INVESTMENT_TYPES, allowsNegativeAmount } from "@/lib/ledger";
import { getCleanDetail } from "@/lib/whisper";
import { AMOUNT_TEXT_CLASS, categoryAvatar } from "@/lib/tx-display";
import { ANALYZING_CATEGORY } from "@/lib/auto-category-policy";
import { reimbursementFromPick, withUnlinkedReimbursement, UNLINKED_REIMBURSEMENT, type CategoryOption } from "@/lib/category-options";
import type { TransactionType } from "@/lib/ledger";
import { cn } from "@/lib/utils";
import { EditableAmountCell, EditableTextCell, SelectableCell, SortHeader } from "./EditableCells";
import { QuickCategoryPicker } from "@/components/categories/QuickCategoryPicker";
import { RowActionsMenu } from "./RowActionsMenu";
import { CELL_TRIGGER } from "./cell-trigger";

export type TableCategory = { id?: string; name: string; type: string; color?: string | null; icon?: string | null };

interface ColumnsOptions {
  selecting: boolean;
  categories: TableCategory[];
  creditCards: Card[];
  isLoadingCards: boolean;
  isPrivacyMode: boolean;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onDuplicate: (ids: string[]) => void;
  onInlineUpdate: (id: string, field: keyof Transaction, value: unknown) => void;
  withCategoryPicker: (t: Transaction, trigger: ReactElement) => ReactElement;
  categoryOptions: (type: TransactionType) => CategoryOption[];
}

export function useTransactionColumns({
  selecting,
  categories,
  creditCards,
  isLoadingCards,
  isPrivacyMode,
  onEdit,
  onDelete,
  onDuplicate,
  onInlineUpdate,
  withCategoryPicker,
  categoryOptions,
}: ColumnsOptions) {
  return useMemo<ColumnDef<Transaction>[]>(() => {
    return [
      ...(selecting ? [{
        id: "select",
        size: 48, minSize: 48, maxSize: 48,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Seleccionar todo"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Seleccionar fila"
            className="translate-y-[2px]"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      }] as ColumnDef<Transaction>[] : []),

      {
        accessorKey: "date",
        size: 120, minSize: 120, maxSize: 120,
        header: ({ column }) => <SortHeader column={column} label="Fecha" />,
        cell: ({ row }) => {
          const date = new Date(row.original.date);
          return (
            <div className={cn("font-medium text-sm", isPrivacyMode && "privacy-blur-light")}>
              <InlineDateTimePicker
                value={date}
                onChange={(newDate) => onInlineUpdate(row.original.id, "date", newDate.toISOString())}
                showTime={true}
              />
            </div>
          );
        },
      },

      {
        accessorKey: "detail",
        size: 310, minSize: 220,
        header: "Detalle",
        cell: ({ row }) => {
          const raw = row.original.detail || "";
          const clean = getCleanDetail(raw);
          const isBot = raw.startsWith("🤖");
          const avatar = categoryAvatar(row.original.category_name, categories);

          return (
            <div className={cn("flex items-center gap-2 max-w-[300px]", isPrivacyMode && "privacy-blur")}>
              <div className="relative flex-shrink-0">
                {withCategoryPicker(row.original, (
                  <button
                    type="button"
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm leading-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={avatar.style}
                    aria-label={`Cambiar categoría (${row.original.category_name})`}
                  >
                    {avatar.emoji}
                  </button>
                ))}
                {isBot && (
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-background flex items-center justify-center"
                    title="Detectado por el bot"
                  >
                    <span className="text-xs leading-none scale-75">🤖</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <EditableTextCell
                  value={clean}
                  onSave={(newDetail) => {
                    const prefix = isBot ? "🤖 " : "";
                    onInlineUpdate(row.original.id, "detail", newDetail ? prefix + newDetail : null);
                  }}
                  placeholder="Agregar detalle..."
                  className="text-sm text-muted-foreground"
                />
                {row.original.bank_description && row.original.bank_description !== clean && (
                  <p
                    className="text-xs truncate leading-none mt-0.5"
                    title={row.original.bank_description}
                  >
                    {row.original.bank_description}
                  </p>
                )}
              </div>
            </div>
          );
        },
      },

      {
        accessorKey: "category_name",
        size: 200, minSize: 170, maxSize: 240,
        header: ({ column }) => <SortHeader column={column} label="Categoría" />,
        cell: ({ row }) => {
          const categoryName = row.original.category_name;
          const type = row.original.type;
          const isMissing = categoryName === "Sin categoría";
          const isReimbursement = type === "Ingreso" && categoryName.toLowerCase().includes("reembolso");
          const linkedCategory = row.original.reimbursement_for_category;

          if (row.original.isPending || categoryName === ANALYZING_CATEGORY) return <AnalyzingBadge saving={row.original.isPending} />;

          const dotColor = categories.find(c => c.name === categoryName)?.color;

          return (
            <div className={cn("flex items-center gap-1 overflow-hidden", isPrivacyMode && "privacy-blur")}>
              {withCategoryPicker(row.original, (
                  <button className={cn(CELL_TRIGGER, "max-w-full overflow-hidden")}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {dotColor && (
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: dotColor }}
                        />
                      )}
                      <span
                        className={cn(
                          "font-medium text-sm truncate",
                          isMissing && "text-amber-500"
                        )}
                        title={categoryName}
                      >
                        {categoryName}
                      </span>
                    </div>
                    <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                  </button>
              ))}
              {isReimbursement && (
                <QuickCategoryPicker
                  value={linkedCategory || UNLINKED_REIMBURSEMENT.name}
                  options={withUnlinkedReimbursement(categoryOptions("Gasto"))}
                  title="Reembolso de"
                  onPick={(name) => onInlineUpdate(row.original.id, "reimbursement_for_category", reimbursementFromPick(name))}
                >
                  <button
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs leading-none flex-shrink-0",
                      "cursor-pointer transition-all hover:brightness-125",
                      linkedCategory
                        ? "bg-success/15 text-success font-medium"
                        : "bg-white/5 italic"
                    )}
                  >
                    <Undo2 className="h-2 w-2 flex-shrink-0" />
                    {linkedCategory || "vincular"}
                  </button>
                </QuickCategoryPicker>
              )}
            </div>
          );
        },
      },

      ...((isLoadingCards || creditCards.length > 0) ? [{
        id: "card",
        size: 90, minSize: 80, maxSize: 110,
        header: () => (
          <div className="flex items-center gap-1 text-xs font-medium">
            <CreditCard className="h-3.5 w-3.5" />
            Tarjeta
          </div>
        ),
        cell: ({ row }: { row: { original: Transaction } }) => {
          const type = row.original.type;
          const cardId = row.original.card_id;
          if (INVESTMENT_TYPES.includes(type)) return <span className="text-xs">—</span>;

          const selectedCard = creditCards.find(c => c.id === cardId);

          return (
            <SelectableCell
              value={cardId || ""}
              options={[
                { value: "", label: "Cuenta" },
                ...creditCards.map(c => ({ value: c.id, label: c.name })),
              ]}
              onSave={(newCardId) => onInlineUpdate(row.original.id, "card_id", newCardId || null)}
              renderValue={() => {
                if (!selectedCard) {
                  return (
                    <span className="text-xs flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      Cuenta
                    </span>
                  );
                }
                const digits = selectedCard.last_4_digits;
                return (
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: selectedCard.color || "#6366f1" }}
                    />
                    <span className="text-xs font-medium">
                      {digits ? `****${digits}` : selectedCard.name}
                    </span>
                  </div>
                );
              }}
            />
          );
        },
      }] as ColumnDef<Transaction>[] : []),

      {
        accessorKey: "amount",
        size: 170, minSize: 150, maxSize: 180,
        header: ({ column }) => <SortHeader column={column} label="Monto" alignEnd />,
        cell: ({ row }) => {
          const amount = parseFloat(row.getValue("amount"));
          const type = row.original.type;

          return (
            <div className={cn("flex items-center justify-end", isPrivacyMode && "privacy-blur")}>
              <EditableAmountCell
                value={amount}
                allowNegative={allowsNegativeAmount(type)}
                onSave={(newAmount) => onInlineUpdate(row.original.id, "amount", newAmount)}
                className={cn("text-sm font-medium", AMOUNT_TEXT_CLASS[type])}
              />
            </div>
          );
        },
      },

      {
        id: "actions",
        size: 60, minSize: 60, maxSize: 60,
        cell: ({ row }) => (
          <RowActionsMenu
            variant="table"
            onEdit={() => onEdit(row.original)}
            onDuplicate={() => onDuplicate([row.original.id])}
            onDelete={() => onDelete(row.original.id)}
          />
        ),
      },
    ];
  }, [selecting, onEdit, onDelete, onDuplicate, categories, creditCards, isLoadingCards, isPrivacyMode, onInlineUpdate, withCategoryPicker, categoryOptions]);
}
