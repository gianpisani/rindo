import { CARD_PAYMENT_CATEGORY, CARD_PAYMENT_ICON, isCardPaymentCategory, type TransactionType } from "./ledger";

export interface CategoryOption {
  name: string;
  icon: string;
  color?: string | null;
}

export const UNLINKED_REIMBURSEMENT: CategoryOption = { name: "Sin vincular", icon: "🔗", color: null };

export const withUnlinkedReimbursement = (options: CategoryOption[]) => [UNLINKED_REIMBURSEMENT, ...options];

export const reimbursementFromPick = (name: string) => (name === UNLINKED_REIMBURSEMENT.name ? null : name);

export function cardPaymentOption(options: CategoryOption[], type: TransactionType): CategoryOption | null {
  if (type !== "Gasto" && type !== "Ingreso") return null;
  return options.find((o) => isCardPaymentCategory(o.name)) ?? { name: CARD_PAYMENT_CATEGORY, icon: CARD_PAYMENT_ICON, color: null };
}

export function uniqueByName(options: CategoryOption[]) {
  const seen = new Set<string>();
  return options.filter((o) => !seen.has(o.name) && seen.add(o.name));
}

export function rankFirst(options: CategoryOption[], firstNames: string[]) {
  const rank = (name: string) => (firstNames.includes(name) ? firstNames.indexOf(name) : firstNames.length);
  return [...options].sort((a, b) => rank(a.name) - rank(b.name));
}
