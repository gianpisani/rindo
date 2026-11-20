import type { Transaction } from "@/hooks/useTransactions";
import { ANALYZING_CATEGORY } from "@/lib/auto-category-policy";
import type { TransactionType } from "@/lib/ledger";
import { getCategoryIcon } from "@/lib/category-icon";
import { tintColor } from "@/lib/category-color";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";

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

export function categoryAvatar(name: string, categories: { name: string; icon?: string | null; color?: string | null }[]) {
  const category = categories.find((c) => c.name === name);
  return {
    emoji: name === ANALYZING_CATEGORY ? "⚡" : category?.icon || getCategoryIcon(name),
    style: { backgroundColor: tintColor(category?.color) },
  };
}

export function formatGroupDate(dayKey: string): string {
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  if (dayKey === today) return "Hoy";
  if (dayKey === yesterday) return "Ayer";
  const [y, m, d] = dayKey.split("-").map(Number);
  return format(new Date(y, m - 1, d), "EEEE d 'de' MMMM", { locale: es });
}
