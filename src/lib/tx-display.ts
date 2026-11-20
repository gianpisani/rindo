import type { Transaction } from "@/hooks/useTransactions";
import { ANALYZING_CATEGORY } from "@/lib/auto-category-policy";
import type { TransactionType } from "@/lib/ledger";

/**
 * El color del monto por tipo, el mismo que usa el resto de la app. El gasto
 * va en el color del texto: el rojo queda solo para lo que avisa. Un mapa en
 * vez de ternarios: un tipo nuevo no se cuela mal pintado.
 */
export const AMOUNT_TONE: Record<TransactionType, string> = {
  Ingreso: "oklch(var(--success))",
  Gasto: "var(--foreground)",
  Inversión: "var(--inicio-blue)",
  Rescate: "var(--inicio-cyan)",
  Rendimiento: "var(--inicio-violet)",
  Reembolso: "oklch(var(--success))",
};

/** Guardándose o esperando a que Jev lo categorice. */
export const isAnalyzing = (t: Transaction) => Boolean(t.isPending) || t.category_name === ANALYZING_CATEGORY;

/**
 * Por revisar: lo que quedó "Sin categoría". Es la única marca confiable que
 * existe: el banco y el correo lo traen así, y Jev lo deja así cuando no está
 * seguro (lo que sí categoriza con confianza ya no está "Sin categoría").
 */
export const needsReview = (t: Transaction) => !t.isPending && t.category_name === "Sin categoría";

export const AMOUNT_TEXT_CLASS: Record<TransactionType, string> = {
  Ingreso: "text-success",
  Gasto: "text-foreground",
  Inversión: "text-blue-600 dark:text-blue-500",
  Rescate: "text-cyan-700 dark:text-cyan-500",
  Rendimiento: "text-violet-600 dark:text-violet-500",
  Reembolso: "text-success",
};
