import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { HTMLAttributes } from "react";
import { InicioTxRow } from "@/components/InicioTxRow";
import type { Transaction } from "@/hooks/useTransactions";
import type { InlineEdit } from "@/hooks/useInlineEdit";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { signPrefix } from "@/lib/ledger";
import { AMOUNT_TONE, isAnalyzing } from "@/lib/tx-display";
import { cn } from "@/lib/utils";

const clp = (value: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(value);

const tint = (color?: string | null) => ({
  background: `color-mix(in oklch, ${color || "var(--muted-foreground)"} 22%, transparent)`,
});

interface Props extends HTMLAttributes<HTMLDivElement> {
  t: Transaction;
  edit: InlineEdit;
  /** "time" (13:48) en listas agrupadas por día; "date" (26 sep) en listas largas. */
  when?: "time" | "date";
}

/** Un movimiento editable en su lugar: ícono, detalle, categoría y monto. */
export function TxRow({ t, edit, when = "time", className, ...rest }: Props) {
  const { isPrivacyMode } = usePrivacyMode();
  const analyzing = isAnalyzing(t);
  const isBot = (t.detail || "").startsWith("🤖");
  const detail = (t.detail || "").replace(/^🤖\s*/, "").trim();
  const stamp = format(new Date(t.date), when === "time" ? "HH:mm" : "d MMM", { locale: es });
  // El reembolso muestra a qué gasto devuelve: esa relación no se edita acá.
  const categoryEditable = !analyzing && !t.reimbursement_for_category;

  return (
    <InicioTxRow
      className={cn(
        edit.changed.has(t.id) && "is-resolved",
        edit.leaving.has(t.id) && "is-leaving",
        className
      )}
      icon={
        <span
          className={cn("inicio-ico", analyzing && "is-thinking")}
          style={tint(analyzing ? "var(--inicio-violet)" : edit.colorOf(t.category_name))}
        >
          {/* La key cambia con el estado: así el ícono nuevo entra con su propio rebote */}
          <span key={analyzing ? "thinking" : t.category_name} className="glyph">
            {analyzing ? "⚡" : edit.emojiOf(t.category_name)}
          </span>
          {isBot && <span className="inicio-bot">🤖</span>}
        </span>
      }
      detail={detail}
      amount={Math.abs(Number(t.amount))}
      sign={signPrefix(t.type, Number(t.amount))}
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
      formatAmount={clp}
      onSave={(changes) => edit.save(t, {
        ...changes,
        ...(changes.detail !== undefined && { detail: changes.detail ? (isBot ? `🤖 ${changes.detail}` : changes.detail) : null }),
        ...(changes.amount !== undefined && { amount: Number(t.amount) < 0 ? -changes.amount : changes.amount }),
      })}
      onDelete={() => edit.remove(t)}
      {...rest}
    />
  );
}
