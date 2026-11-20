import { useMemo, type ReactElement } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CreditCard, Undo2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineDateTimePicker } from "@/components/ui/date-time-picker";
import { InlineAmount, InlineText } from "@/components/transactions/InlineTxField";
import { TxIcon } from "@/components/transactions/TxIcon";
import type { Transaction } from "@/hooks/useTransactions";
import type { CreditCard as Card } from "@/hooks/useCreditCards";
import { INVESTMENT_TYPES, allowsNegativeAmount, signPrefix } from "@/lib/ledger";
import { getCleanDetail } from "@/lib/whisper";
import { AMOUNT_TONE, categoryAvatar, isAnalyzing } from "@/lib/tx-display";
import { detailToSave, isBotDetail } from "@/lib/tx-detail";
import { tintColor } from "@/lib/category-color";
import { reimbursementFromPick, withUnlinkedReimbursement, UNLINKED_REIMBURSEMENT, type CategoryOption } from "@/lib/category-options";
import type { TransactionType } from "@/lib/ledger";
import { cn } from "@/lib/utils";
import { SelectableCell, SortHeader } from "./EditableCells";
import { QuickCategoryPicker } from "@/components/categories/QuickCategoryPicker";
import { RowActionsMenu } from "./RowActionsMenu";

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
    const colorOf = (name: string) => categories.find((c) => c.name === name)?.color;

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
        cell: ({ row }) => (
          <div className={cn("text-sm", isPrivacyMode && "privacy-blur-light")}>
            <InlineDateTimePicker
              value={new Date(row.original.date)}
              onChange={(newDate) => onInlineUpdate(row.original.id, "date", newDate.toISOString())}
              showTime={true}
            />
          </div>
        ),
      },

      {
        accessorKey: "detail",
        size: 310, minSize: 220,
        header: "Detalle",
        cell: ({ row }) => {
          const t = row.original;
          const clean = getCleanDetail(t.detail);
          const bank = t.bank_description && t.bank_description !== clean ? t.bank_description : null;

          return (
            <div className="flex items-center gap-2">
              {withCategoryPicker(t, (
                <button
                  type="button"
                  className="grid size-9 flex-none place-items-center rounded-full"
                  aria-label={`Cambiar categoría (${t.category_name})`}
                >
                  <TxIcon
                    emoji={categoryAvatar(t.category_name, categories).emoji}
                    color={colorOf(t.category_name)}
                    thinking={isAnalyzing(t)}
                    bot={isBotDetail(t.detail)}
                  />
                </button>
              ))}
              <div className={cn("min-w-0 flex-1 text-sm", isPrivacyMode && "privacy-blur")}>
                <InlineText
                  value={clean}
                  editable={!t.isPending}
                  label="Detalle del movimiento"
                  placeholder="Agregar detalle"
                  title={clean || undefined}
                  onSave={(next) => onInlineUpdate(t.id, "detail", detailToSave(t.detail, next))}
                />
                {bank && (
                  <p className="truncate text-xs text-muted-foreground" title={bank}>
                    {bank}
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
          const t = row.original;
          const categoryName = t.category_name;
          const isMissing = categoryName === "Sin categoría";
          const isReimbursement = t.type === "Ingreso" && categoryName.toLowerCase().includes("reembolso");
          const linkedCategory = t.reimbursement_for_category;

          if (isAnalyzing(t)) {
            return (
              <span className="inicio-thinking block truncate text-xs" role="status">
                {t.isPending ? "Guardando…" : "Jev está categorizando…"}
              </span>
            );
          }

          return (
            <div className={cn("flex items-center gap-2 text-sm", isPrivacyMode && "privacy-blur")}>
              {withCategoryPicker(t, (
                <button type="button" className="tx-category inicio-editable inicio-pick min-w-0" title={categoryName}>
                  <span
                    className="mr-2 inline-block size-2 rounded-full align-middle"
                    style={{ background: tintColor(colorOf(categoryName), 100) }}
                    aria-hidden="true"
                  />
                  <span className={cn(isMissing && "text-amber-500")}>{categoryName}</span>
                </button>
              ))}
              {isReimbursement && (
                <QuickCategoryPicker
                  value={linkedCategory || UNLINKED_REIMBURSEMENT.name}
                  options={withUnlinkedReimbursement(categoryOptions("Gasto"))}
                  title="Reembolso de"
                  onPick={(name) => onInlineUpdate(t.id, "reimbursement_for_category", reimbursementFromPick(name))}
                >
                  <button
                    type="button"
                    className={cn(
                      "inline-flex flex-none items-center gap-1 rounded-full px-2 text-xs leading-5 transition-[filter] hover:brightness-125",
                      linkedCategory ? "bg-success/15 font-medium text-success" : "bg-muted italic text-muted-foreground"
                    )}
                  >
                    <Undo2 className="size-3 flex-none" />
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
          const t = row.original;
          if (INVESTMENT_TYPES.includes(t.type)) return <span className="text-xs text-muted-foreground">—</span>;

          const selectedCard = creditCards.find(c => c.id === t.card_id);

          return (
            <div className="text-xs">
            <SelectableCell
              value={t.card_id || ""}
              options={[
                { value: "", label: "Cuenta" },
                ...creditCards.map(c => ({ value: c.id, label: c.name })),
              ]}
              onSave={(newCardId) => onInlineUpdate(t.id, "card_id", newCardId || null)}
              label={`Tarjeta: ${selectedCard?.name ?? "Cuenta"}`}
            >
              {selectedCard ? (
                <>
                  <span
                    className="mr-1 inline-block size-2 rounded-full align-middle"
                    style={{ background: tintColor(selectedCard.color, 100) }}
                    aria-hidden="true"
                  />
                  {selectedCard.last_4_digits ? `****${selectedCard.last_4_digits}` : selectedCard.name}
                </>
              ) : (
                <span className="text-muted-foreground">Cuenta</span>
              )}
            </SelectableCell>
            </div>
          );
        },
      }] as ColumnDef<Transaction>[] : []),

      {
        accessorKey: "amount",
        size: 170, minSize: 150, maxSize: 180,
        header: ({ column }) => <SortHeader column={column} label="Monto" alignEnd />,
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div className={cn("text-right text-sm", isPrivacyMode && "privacy-blur")}>
              <InlineAmount
                amount={Number(t.amount)}
                signOf={(amount) => signPrefix(t.type, amount)}
                color={AMOUNT_TONE[t.type]}
                allowNegative={allowsNegativeAmount(t.type)}
                editable={!t.isPending}
                onSave={(amount) => onInlineUpdate(t.id, "amount", amount)}
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
