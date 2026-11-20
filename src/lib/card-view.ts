import { format } from "date-fns";
import { es } from "date-fns/locale";
import { billingCycle } from "./card-cycle.ts";
import { installmentProgress } from "./installments.ts";

type InstallmentLike = Parameters<typeof installmentProgress>[0] & { installment_amount: number };

export const withoutEmoji = (text: string) =>
  text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();

export const shortDay = (d: Date) => format(d, "d MMM", { locale: es }).replace(".", "");

export const shortMonthYear = (d: Date) => format(d, "MMM yyyy", { locale: es }).replace(".", "");

export function labeledCycle(billingDay: number, offset: number, now = new Date()) {
  const cycle = billingCycle(billingDay, offset, now);
  return { ...cycle, label: format(cycle.end, "MMMM yyyy", { locale: es }) };
}

export function installmentsOverview<T extends InstallmentLike>(installments: T[], today = new Date()) {
  const rows = installments.map((installment) => ({ installment, progress: installmentProgress(installment, today) }));
  const active = rows.filter((r) => r.progress.active);
  return {
    rows: [...active, ...rows.filter((r) => !r.progress.active)],
    monthlyPayment: active.reduce((sum, r) => sum + r.installment.installment_amount, 0),
  };
}
