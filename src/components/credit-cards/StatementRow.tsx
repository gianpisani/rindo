import { QuickCategoryPicker } from "@/components/categories/QuickCategoryPicker";
import { TxIcon } from "@/components/transactions/TxIcon";
import type { InlineEdit } from "@/hooks/useInlineEdit";
import type { Transaction } from "@/hooks/useTransactions";
import { statementDetail } from "@/lib/card-view";
import { groupDigits, shortDay } from "@/lib/format";
import { isCardPayment, signPrefix } from "@/lib/ledger";
import { AMOUNT_TONE, isAnalyzing } from "@/lib/tx-display";
import { cn } from "@/lib/utils";

interface StatementRowProps {
  tx: Transaction;
  edit: InlineEdit;
  isPrivacyMode: boolean;
}

export function StatementRow({ tx, edit, isPrivacyMode }: StatementRowProps) {
  const payment = isCardPayment(tx);
  const analyzing = isAnalyzing(tx);
  const detail = statementDetail(tx.detail || tx.category_name);
  const amount = Number(tx.amount);
  const categoryEditable = !analyzing && !payment && !tx.reimbursement_for_category;
  const icon = <TxIcon emoji={edit.emojiOf(tx.category_name)} color={edit.colorOf(tx.category_name)} thinking={analyzing} />;

  return (
    <div className="tj-tx">
      {categoryEditable ? (
        <QuickCategoryPicker
          value={tx.category_name}
          options={edit.categoryOptions(tx.type)}
          title={detail}
          onPick={(name) => edit.save(tx, { category_name: name })}
        >
          <button className="flex-none rounded-full" aria-label={`Cambiar categoría (${tx.category_name})`}>
            {icon}
          </button>
        </QuickCategoryPicker>
      ) : (
        icon
      )}
      <div className={cn("body", isPrivacyMode && "privacy-blur")}>
        <div className="n">{detail}</div>
        <div className="c">
          {shortDay(new Date(tx.date))} · {tx.category_name}
        </div>
      </div>
      <span
        className={cn("v", isPrivacyMode && "privacy-blur")}
        style={{ color: payment ? "oklch(var(--success))" : AMOUNT_TONE[tx.type] }}
      >
        {payment ? "+" : signPrefix(tx.type, amount)}${groupDigits(Math.abs(amount))}
      </span>
    </div>
  );
}
