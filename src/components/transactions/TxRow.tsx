import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { HTMLAttributes } from "react";
import { InicioTxRow } from "@/components/transactions/InicioTxRow";
import { TxIcon } from "@/components/transactions/TxIcon";
import type { Transaction } from "@/hooks/useTransactions";
import type { InlineEdit } from "@/hooks/useInlineEdit";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useFlashedRows } from "@/hooks/useRowFlash";
import { signPrefix } from "@/lib/ledger";
import { AMOUNT_TONE, isAnalyzing } from "@/lib/tx-display";
import { cn } from "@/lib/utils";

interface Props extends HTMLAttributes<HTMLDivElement> {
  t: Transaction;
  edit: InlineEdit;
  when?: "time" | "date";
}

export function TxRow({ t, edit, when = "time", className, ...rest }: Props) {
  const { isPrivacyMode } = usePrivacyMode();
  const flashed = useFlashedRows();
  const analyzing = isAnalyzing(t);
  const isBot = (t.detail || "").startsWith("🤖");
  const detail = (t.detail || "").replace(/^🤖\s*/, "").trim();
  const stamp = format(new Date(t.date), when === "time" ? "HH:mm" : "d MMM", { locale: es });
  const categoryEditable = !analyzing && !t.reimbursement_for_category;

  return (
    <InicioTxRow
      className={cn(
        flashed.has(t.id) && "is-resolved",
        edit.leaving.has(t.id) && "is-leaving",
        className
      )}
      icon={
        <TxIcon
          emoji={edit.emojiOf(t.category_name)}
          color={edit.colorOf(t.category_name)}
          thinking={analyzing}
          bot={isBot}
        />
      }
      detail={detail}
      amount={Number(t.amount)}
      signOf={(amount) => signPrefix(t.type, amount)}
      amountColor={AMOUNT_TONE[t.type]}
      category={categoryEditable ? t.category_name : undefined}
      categoryOptions={edit.categoryOptions(t.type)}
      meta={
        analyzing ? (
          <span className="inicio-thinking" role="status">
            {t.isPending ? "Guardando…" : "Jev está categorizando…"}
          </span>
        ) : t.reimbursement_for_category ? (
          `Reembolso de ${t.reimbursement_for_category} · ${stamp}`
        ) : (
          ` · ${stamp}`
        )
      }
      editable={!analyzing && !t.isPending}
      privacy={isPrivacyMode}
      onSave={(changes) => edit.save(t, {
        ...changes,
        ...(changes.detail !== undefined && { detail: changes.detail ? (isBot ? `🤖 ${changes.detail}` : changes.detail) : null }),
      })}
      onDelete={() => edit.remove(t)}
      {...rest}
    />
  );
}
