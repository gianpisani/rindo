import type { ReactElement } from "react";
import type { Row } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { AnalyzingBadge } from "@/components/transactions/AnalyzingBadge";
import type { Transaction } from "@/hooks/useTransactions";
import { getCleanDetail } from "@/lib/whisper";
import { signPrefix } from "@/lib/ledger";
import { AMOUNT_TEXT_CLASS, categoryAvatar } from "@/lib/tx-display";
import { ANALYZING_CATEGORY } from "@/lib/auto-category-policy";
import { cn } from "@/lib/utils";
import { clp } from "@/lib/format";
import { RowActionsMenu } from "./RowActionsMenu";
import type { TableCategory } from "./useTransactionColumns";

interface MobileTxCardProps {
  row: Row<Transaction>;
  timeLabel: string;
  selecting: boolean;
  categories: TableCategory[];
  isPrivacyMode: boolean;
  withCategoryPicker: (t: Transaction, trigger: ReactElement) => ReactElement;
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
  categories,
  isPrivacyMode,
  withCategoryPicker,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
  onMenuOpenChange,
}: MobileTxCardProps) {
  const t = row.original;
  const clean = getCleanDetail(t.detail);
  const avatar = categoryAvatar(t.category_name, categories);
  const isBot = (t.detail || "").startsWith("🤖");
  const catData = categories.find(c => c.name === t.category_name);
  const isMissing = t.category_name === "Sin categoría";
  const isSelected = row.getIsSelected();
  const avatarButton = (
    <button
      type="button"
      className="w-10 h-10 rounded-full flex items-center justify-center text-xl leading-none select-none"
      style={avatar.style}
      aria-label={`Cambiar categoría (${t.category_name})`}
      tabIndex={selecting ? -1 : undefined}
    >
      {avatar.emoji}
    </button>
  );

  return (
    <div
      className={cn(
        "mobile-tx-card",
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

      <div className="relative flex-shrink-0">
        {selecting ? avatarButton : withCategoryPicker(t, avatarButton)}
        {isBot && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background flex items-center justify-center">
            <span className="text-xs leading-none scale-75">🤖</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 ml-3">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-sm font-medium truncate", isPrivacyMode && "privacy-blur")}>
            {clean || <span className="italic font-normal">Sin detalle</span>}
          </span>
          <span className={cn(
            "text-sm font-medium tabular-nums whitespace-nowrap font-mono",
            AMOUNT_TEXT_CLASS[t.type],
            isPrivacyMode && "privacy-blur"
          )}>
            {signPrefix(t.type, t.amount)}
            {clp(Math.abs(t.amount))}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {t.isPending || t.category_name === ANALYZING_CATEGORY ? (
              <AnalyzingBadge saving={t.isPending} />
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: catData?.color || "currentColor" }} aria-hidden="true" />
                <span className={cn("text-xs truncate", isMissing ? "text-amber-500" : "text-muted-foreground")}>
                  {t.category_name}
                </span>
              </>
            )}
          </div>
          <span className="text-xs tabular-nums flex-shrink-0">
            {timeLabel}
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 ml-1">
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
