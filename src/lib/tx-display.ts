import type { Transaction } from "@/hooks/useTransactions";
import { ANALYZING_CATEGORY } from "@/lib/auto-category-policy";
import type { TransactionType } from "@/lib/ledger";

export const AMOUNT_TONE: Record<TransactionType, string> = {
  Ingreso: "oklch(var(--success))",
  Gasto: "var(--foreground)",
  Inversión: "var(--inicio-blue)",
  Rescate: "var(--inicio-cyan)",
  Rendimiento: "var(--inicio-violet)",
  Reembolso: "oklch(var(--success))",
};

export const isAnalyzing = (t: Transaction) => Boolean(t.isPending) || t.category_name === ANALYZING_CATEGORY;

export const needsReview = (t: Transaction) => !t.isPending && t.category_name === "Sin categoría";

export const AMOUNT_TEXT_CLASS: Record<TransactionType, string> = {
  Ingreso: "text-success",
  Gasto: "text-foreground",
  Inversión: "text-blue-600 dark:text-blue-500",
  Rescate: "text-cyan-700 dark:text-cyan-500",
  Rendimiento: "text-violet-600 dark:text-violet-500",
  Reembolso: "text-success",
};
