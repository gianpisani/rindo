import type { TransactionType } from './ledger';

export interface WhisperDraft {
  value: string;
  type: TransactionType;
  category: string;
  date: string;
  cardId: string;
  shared: boolean;
  reimbursementCategory: string;
  isLoss: boolean;
}

// CLP: reject malformed/decimal-looking amounts instead of silently multiplying them.
export function parseWhisper(input: string) {
  const match = input.trim().match(/^\$?\s*(\d+(?:[.,]\d{3})*)(?:\s+(.+))?$/);
  if (!match) return null;
  const amount = Number(match[1].replace(/[.,]/g, ''));
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  return { amount, detail: match[2]?.trim() || null };
}

export function categoryFrequency(history: { category_name: string; type: string }[], type: string) {
  const counts = new Map<string, number>();
  for (const tx of history) if (tx.type === type) counts.set(tx.category_name, (counts.get(tx.category_name) ?? 0) + 1);
  return counts;
}
