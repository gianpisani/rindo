export const BANKS = [
  { value: "bancosecurity", label: "Banco Security", color: "#7B2D8E" },
  { value: "bchile",        label: "Banco de Chile", color: "#0066CC" },
  { value: "bci",           label: "BCI",            color: "#4CAF50" },
  { value: "bestado",       label: "BancoEstado",    color: "#F57C00" },
  { value: "bice",          label: "BICE",           color: "#5B9BD5" },
  { value: "edwards",       label: "Banco Edwards",  color: "#00897B" },
  { value: "falabella",     label: "Banco Falabella",color: "#8CC63F" },
  { value: "itau",          label: "Itaú",           color: "#EC7000" },
  { value: "santander",     label: "Santander",      color: "#EC0000" },
  { value: "scotiabank",    label: "Scotiabank",     color: "#EC1C24" },
] as const;

export type Bank = typeof BANKS[number];

export function getBankById(id: string): Bank | undefined {
  return BANKS.find((b) => b.value === id);
}

export const SYNC_SCHEDULES = [
  { value: "daily_08",    label: "Diario a las 8:00",          shortLabel: "8:00" },
  { value: "daily_14",    label: "Diario a las 14:00",         shortLabel: "14:00" },
  { value: "daily_20",    label: "Diario a las 20:00",         shortLabel: "20:00" },
  { value: "twice_daily", label: "2 veces al día (8:00/20:00)", shortLabel: "2x/día" },
  { value: "custom",      label: "Hora personalizada",          shortLabel: "Custom" },
  { value: "disabled",   label: "Solo manual",                 shortLabel: "Manual" },
] as const;

export type SyncScheduleId = typeof SYNC_SCHEDULES[number]["value"] | `custom_${string}`;

export function isCustomSchedule(id: string): boolean {
  return id.startsWith("custom_");
}

export function getCustomHour(id: string): number {
  return parseInt(id.split("_")[1], 10);
}

const SCHEDULE_TIMES: Record<string, string> = {
  daily_08: "las 8:00",
  daily_14: "las 14:00",
  daily_20: "las 20:00",
  twice_daily: "las 8:00 y 20:00",
};

export function scheduleTimePhrase(id: string): string {
  if (isCustomSchedule(id)) return `las ${getCustomHour(id)}:00`;
  return SCHEDULE_TIMES[id] ?? id;
}

export function cleanRut(value: string): string {
  return value.replace(/[^0-9kK]/g, "");
}

export function formatRut(raw: string): string {
  const clean = cleanRut(raw);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean;
  const body = clean.slice(0, -1);
  const verifier = clean.slice(-1).toUpperCase();
  return `${body}-${verifier}`;
}

export function validateRut(value: string): boolean {
  const clean = cleanRut(value);
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const verifier = clean.slice(-1).toUpperCase();
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = sum % 11;
  const expected = remainder === 0 ? "0" : remainder === 1 ? "K" : String(11 - remainder);
  return verifier === expected;
}

export const SKIP_REASON_LABELS: Record<string, string> = {
  bank_duplicate: "Ya importada",
  manual_duplicate: "Ingresada manualmente",
  dedup_unverified: "No se pudo revisar si ya existía",
  zero_amount: "Monto $0",
};
