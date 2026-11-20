import { format } from "date-fns";
import { es } from "date-fns/locale";

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const CLP_COMPACT = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", notation: "compact", maximumFractionDigits: 1 });
const DIGITS = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

const MINUS = "−";

const withSign = (value: number, formatted: string) => (value < 0 ? MINUS : "") + formatted;

export const clp = (value: number) => withSign(value, CLP.format(Math.abs(value)));

export const clpCompact = (value: number) => withSign(value, CLP_COMPACT.format(Math.abs(value)));

export const SIGNED_CLP_FORMAT = {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
} as const satisfies Intl.NumberFormatOptions;

export const clpSigned = new Intl.NumberFormat("es-CL", SIGNED_CLP_FORMAT).format;

export const groupDigits = (value: number) => DIGITS.format(value);

export const digitsOnly = (raw: string) => raw.replace(/\D/g, "");

export const parseAmount = (raw: string) => parseInt(digitsOnly(raw), 10) || 0;

export const formatAmountInput = (raw: string) => (raw ? groupDigits(parseAmount(raw)) : "");

export const toLocalInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export const shortDay = (date: Date) => format(date, "d MMM", { locale: es }).replace(".", "");

export const shortMonthYear = (date: Date) => format(date, "MMM yyyy", { locale: es }).replace(".", "");

export const monthYear = (date: Date) => format(date, "MMMM yyyy", { locale: es });
