interface SpendingEntry {
  type: string;
  date: string;
  amount: number;
  category_name: string;
  reimbursement_for_category?: string | null;
}

/** Reimbursements belong to their tagged category and the month received.
 * They reduce spending but never increase the number of purchases.
 */
export function summarizeCategoryPeriod<T extends SpendingEntry>(entries: T[], start: Date, end: Date) {
  const result = new Map<string, { amount: number; reimbursedAmount: number; effectiveAmount: number; count: number; transactions: T[] }>();
  for (const entry of entries) {
    const date = new Date(entry.date);
    if (!Number.isFinite(date.getTime()) || date < start || date > end) continue;
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
