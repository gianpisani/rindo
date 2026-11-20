import { isCardPayment, isCardPaymentCategory } from "./ledger.ts";

interface SpendingEntry {
  type: string;
  date: string;
  amount: number;
  category_name: string;
  reimbursement_for_category?: string | null;
}

/** Reimbursements belong to their tagged category and the month received.
 * They reduce spending but never increase the number of purchases.
 * Card payments are not spending (their purchases already are): skipped.
 */
export function summarizeCategoryPeriod<T extends SpendingEntry>(entries: T[], start: Date, end: Date) {
  const result = new Map<string, { amount: number; reimbursedAmount: number; effectiveAmount: number; count: number; transactions: T[] }>();
  for (const entry of entries) {
    const date = new Date(entry.date);
    if (!Number.isFinite(date.getTime()) || date < start || date > end) continue;
    if (isCardPayment(entry)) continue;
    const expense = entry.type === 'Gasto';
    const reimbursement = ['Ingreso', 'Reembolso'].includes(entry.type) && entry.reimbursement_for_category;
    if (!expense && !reimbursement) continue;
    const category = expense ? entry.category_name : entry.reimbursement_for_category!;
    const row = result.get(category) ?? { amount: 0, reimbursedAmount: 0, effectiveAmount: 0, count: 0, transactions: [] };
    if (expense) { row.amount += Number(entry.amount); row.count++; row.transactions.push(entry); }
    else row.reimbursedAmount += Number(entry.amount);
    result.set(category, row);
  }
  for (const row of result.values()) row.effectiveAmount = Math.max(0, row.amount - row.reimbursedAmount);
  return result;
}

export const DEFAULT_ALERT_AT = 80;

type LimitState = 'over' | 'near' | 'ok';

interface CategoryLimitRule {
  category_name: string;
  monthly_limit: number;
  alert_at_percentage: number | null;
}

export function limitUsage<T extends SpendingEntry>(entries: T[], limits: CategoryLimitRule[], start: Date, end: Date) {
  const spending = summarizeCategoryPeriod(entries, start, end);
  return limits
    .filter((rule) => rule.monthly_limit > 0 && !isCardPaymentCategory(rule.category_name))
    .map((rule) => {
      const spent = spending.get(rule.category_name)?.effectiveAmount ?? 0;
      const usage = (spent / rule.monthly_limit) * 100;
      const state: LimitState = usage > 100 ? 'over' : usage >= (rule.alert_at_percentage || DEFAULT_ALERT_AT) ? 'near' : 'ok';
      return { category: rule.category_name, spent, limit: rule.monthly_limit, usage, state };
    })
    .sort((a, b) => b.usage - a.usage);
}
