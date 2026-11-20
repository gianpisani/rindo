import {
  CARD_PAYMENT_CATEGORY,
  CARD_PAYMENT_ICON,
  isCardPaymentCategory,
} from "../../supabase/functions/_shared/card-payment.ts";

export { CARD_PAYMENT_CATEGORY, CARD_PAYMENT_ICON, isCardPaymentCategory };

export type TransactionType =
  | "Ingreso"
  | "Gasto"
  | "Inversión"
  | "Reembolso"
  | "Rescate"
  | "Rendimiento";

export const TRANSACTION_TYPES: readonly TransactionType[] = [
  "Ingreso",
  "Gasto",
  "Inversión",
  "Rescate",
  "Rendimiento",
  "Reembolso",
] as const;

export const INVESTMENT_TYPES: readonly TransactionType[] = [
  "Inversión",
  "Rescate",
  "Rendimiento",
] as const;

export const SIGNED_TYPES: readonly TransactionType[] = ["Rendimiento"] as const;

export function allowsNegativeAmount(type: TransactionType): boolean {
  return SIGNED_TYPES.includes(type);
}

export const DEFAULT_PASS_THROUGH_CATEGORIES = ["Reembolsos"];

export const DEFAULT_TRANSIT_CATEGORIES = ["Reembolsos", "Conciliación"];

export function isCardPayment(entry: {
  category_name?: string | null;
  reimbursement_for_category?: string | null;
}): boolean {
  return (
    isCardPaymentCategory(entry.category_name) ||
    isCardPaymentCategory(entry.reimbursement_for_category)
  );
}

export interface LedgerEntry {
  type: TransactionType;
  amount: number;
  category_name: string;
  reimbursement_for_category?: string | null;
}

export interface Buckets {
  liquido: number;
  invertido: number;
  patrimonio: number;
}

function isPassThrough(entry: LedgerEntry, passThrough: Set<string>): boolean {
  if (isCardPayment(entry)) return true;
  if (entry.type === "Gasto") return passThrough.has(entry.category_name);
  if (entry.type === "Ingreso") {
    return Boolean(
      entry.reimbursement_for_category &&
        passThrough.has(entry.reimbursement_for_category)
    );
  }
  return false;
}

export function bucketDeltas(
  entry: LedgerEntry,
  passThroughCategories: string[] = DEFAULT_PASS_THROUGH_CATEGORIES
): { liquido: number; invertido: number } {
  const amount = Number(entry.amount);
  if (isPassThrough(entry, new Set(passThroughCategories))) {
    return { liquido: 0, invertido: 0 };
  }
  switch (entry.type) {
    case "Ingreso":
      return { liquido: amount, invertido: 0 };
    case "Gasto":
      return { liquido: -amount, invertido: 0 };
    case "Inversión":
      return { liquido: -amount, invertido: amount };
    case "Rescate":
      return { liquido: amount, invertido: -amount };
    case "Rendimiento":
      return { liquido: 0, invertido: amount };
    case "Reembolso":
    default:
      return { liquido: 0, invertido: 0 };
  }
}

export function computeBuckets(
  entries: LedgerEntry[],
  passThroughCategories: string[] = DEFAULT_PASS_THROUGH_CATEGORIES
): Buckets {
  const passThrough = new Set(passThroughCategories);
  let liquido = 0;
  let invertido = 0;
  for (const entry of entries) {
    if (isPassThrough(entry, passThrough)) continue;
    const delta = bucketDeltas(entry, passThroughCategories);
    liquido += delta.liquido;
    invertido += delta.invertido;
  }
  return { liquido, invertido, patrimonio: liquido + invertido };
}

export function displaySign(type: TransactionType): -1 | 1 {
  return type === "Gasto" || type === "Inversión" ? -1 : 1;
}

export function signPrefix(type: TransactionType, amount: number): string {
  if (type === "Rendimiento") return amount > 0 ? "+" : amount < 0 ? "−" : "";
  if (type === "Ingreso" || type === "Rescate") return "+";
  if (type === "Gasto" || type === "Inversión") return "−";
  return "";
}
