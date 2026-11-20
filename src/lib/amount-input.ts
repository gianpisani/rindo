import { groupDigits } from "./format.ts";

export const parseAmount = (raw: string) => parseInt(raw.replace(/\D/g, ""), 10) || 0;

export const formatAmountInput = (raw: string) => (raw ? groupDigits(parseAmount(raw)) : "");
