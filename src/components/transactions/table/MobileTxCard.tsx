import type { ReactElement } from "react";
import type { Row } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineAmount, InlineText } from "@/components/transactions/InlineTxField";
import { TxIcon } from "@/components/transactions/TxIcon";
import type { Transaction } from "@/hooks/useTransactions";
import { getCleanDetail } from "@/lib/whisper";
import { allowsNegativeAmount, signPrefix } from "@/lib/ledger";
import { AMOUNT_TONE, categoryAvatar, isAnalyzing } from "@/lib/tx-display";
import { detailToSave, isBotDetail } from "@/lib/tx-detail";
import { cn } from "@/lib/utils";
import { RowActionsMenu } from "./RowActionsMenu";
import type { TableCategory } from "./useTransactionColumns";

interface MobileTxCardProps {
  row: Row<Transaction>;
  timeLabel: string;
  selecting: boolean;
  resolved: boolean;
  categories: TableCategory[];
  isPrivacyMode: boolean;
  withCategoryPicker: (t: Transaction, trigger: ReactElement) => ReactElement;
  onInlineUpdate: (id: string, field: keyof Transaction, value: unknown) => void;
  onOpen: (t: Transaction) => void;
  onEdit: (t: Transaction) => void;
  onDuplicate: (ids: string[]) => void;
  onDelete: (id: string) => void;
  onMenuOpenChange: (open: boolean) => void;
}

export function MobileTxCard({
  row,
  timeLabel,
  selecting,
  resolved,
  categories,
  isPrivacyMode,
  withCategoryPicker,
  onInlineUpdate,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
  onMenuOpenChange,
}: MobileTxCardProps) {
  const t = row.original;
  const analyzing = isAnalyzing(t);
  const isMissing = t.category_name === "Sin categoría";
  const isSelected = row.getIsSelected();
  const editable = !selecting && !t.isPending;
  const icon = (
    <TxIcon
      emoji={categoryAvatar(t.category_name, categories).emoji}
      color={categories.find((c) => c.name === t.category_name)?.color}
      thinking={analyzing}
      bot={isBotDetail(t.detail)}
    />
  );

  return (
    <div
      className={cn(
        "mobile-tx-card",
        editable && "is-editable",
        resolved && "is-resolved",
        t.isPending && "pointer-events-none opacity-60",
        isSelected && "mobile-tx-card-selected",
        isMissing && "mobile-tx-card-missing"
      )}
      onClick={() => (selecting ? row.toggleSelected(!isSelected) : onOpen(t))}
    >
      {selecting && (
        <div className="mobile-tx-checkbox">
          <Checkbox checked={isSelected} className="h-4 w-4" tabIndex={-1} />
        </div>
      )}

      {selecting ? (
        <span className="grid size-9 flex-none place-items-center">{icon}</span>
      ) : (
        withCategoryPicker(t, (
          <button
            type="button"
            className="grid size-9 flex-none place-items-center rounded-full"
            aria-label={`Cambiar categoría (${t.category_name})`}
          >
            {icon}
          </button>
        ))
      )}

      <div className="ml-2 min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <div className={cn("min-w-0 flex-1", isPrivacyMode && "privacy-blur")}>
            <InlineText
              value={getCleanDetail(t.detail)}
              editable={editable}
              label="Detalle del movimiento"
              onSave={(next) => onInlineUpdate(t.id, "detail", detailToSave(t.detail, next))}
            />
          </div>
          <InlineAmount
            className={cn("flex-none", isPrivacyMode && "privacy-blur")}
            amount={Number(t.amount)}
            signOf={(amount) => signPrefix(t.type, amount)}
            color={AMOUNT_TONE[t.type]}
            allowNegative={allowsNegativeAmount(t.type)}
            editable={editable}
            onSave={(amount) => onInlineUpdate(t.id, "amount", amount)}
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          {analyzing ? (
            <span className="inicio-thinking truncate" role="status">
              {t.isPending ? "Guardando…" : "Jev está categorizando…"}
            </span>
          ) : (
            <span className={cn("tx-category truncate", isMissing && "text-amber-500")}>
              {t.reimbursement_for_category ? `Reembolso de ${t.reimbursement_for_category}` : t.category_name}
            </span>
          )}
          <span className="flex-none tabular-nums">{timeLabel}</span>
        </div>
      </div>

      <div className="ml-1 flex-shrink-0">
        <RowActionsMenu
          variant="card"
          onOpenChange={onMenuOpenChange}
          onEdit={() => onEdit(t)}
          onDuplicate={() => onDuplicate([t.id])}
          onDelete={() => onDelete(t.id)}
        />
      </div>
    </div>
  );
}
