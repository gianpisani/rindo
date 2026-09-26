import type { Transaction } from "@/hooks/useTransactions";
import { ANALYZING_CATEGORY } from "@/lib/auto-category-policy";
import type { TransactionType } from "@/lib/ledger";

/**
 * El color del monto por tipo. El gasto no lleva color: es lo normal, no una
 * alerta. Un mapa en vez de ternarios: un tipo nuevo no se cuela mal pintado.
 * Los valores son variables de `.inicio` (index.css).
 */
export const AMOUNT_TONE: Record<TransactionType, string | undefined> = {
  Ingreso: "var(--inicio-emerald)",
  Gasto: undefined,
  Inversión: "var(--inicio-blue)",
  Rescate: "var(--inicio-cyan)",
  Rendimiento: "var(--inicio-violet)",
  Reembolso: "var(--inicio-emerald)",
};

/** Guardándose o esperando a que Jev lo categorice. */
export const isAnalyzing = (t: Transaction) => Boolean(t.isPending) || t.category_name === ANALYZING_CATEGORY;
