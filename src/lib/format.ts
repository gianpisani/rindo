const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const CLP_COMPACT = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", notation: "compact", maximumFractionDigits: 1 });
const DIGITS = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

const MINUS = "−";

const withSign = (value: number, formatted: string) => (value < 0 ? MINUS : "") + formatted;

export const clp = (value: number) => withSign(value, CLP.format(Math.abs(value)));

export const clpCompact = (value: number) => withSign(value, CLP_COMPACT.format(Math.abs(value)));

export const groupDigits = (value: number) => DIGITS.format(value);

export const toLocalInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
