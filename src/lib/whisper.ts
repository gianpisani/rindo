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

/** Los seis tipos con su color y el ejemplo del placeholder, en el orden del Whisper. */
export const WHISPER_TYPES: { type: TransactionType; color: string; placeholder: string }[] = [
  { type: 'Gasto', color: '#f87171', placeholder: '15000 almuerzo' },
  { type: 'Ingreso', color: '#4ade80', placeholder: '1500000 sueldo' },
  { type: 'Inversión', color: '#60a5fa', placeholder: '200000 fintual' },
  { type: 'Rescate', color: '#22d3ee', placeholder: '200000 retiro del fondo' },
  { type: 'Rendimiento', color: '#a78bfa', placeholder: '25000 rendimiento del mes' },
  { type: 'Reembolso', color: '#fbbf24', placeholder: '12000 devolución almuerzo' },
];
