import { addMonths } from "date-fns";
import { monthYear } from "./format.ts";

const DEFAULT_INSTALLMENT_CATEGORY = "Otros gastos";

type InstallmentPlan = {
  description: string;
  total_installments: number;
  installment_amount: number;
  first_installment_date: string;
  category_name: string | null;
  card_id: string;
};

export function installmentTransactions(plan: InstallmentPlan, installmentId: string, userId: string) {
  const first = new Date(plan.first_installment_date);
  return Array.from({ length: plan.total_installments }, (_, index) => {
    const date = addMonths(first, index);
    const month = monthYear(date);
    return {
      user_id: userId,
      amount: plan.installment_amount,
      type: "Gasto" as const,
      category_name: plan.category_name || DEFAULT_INSTALLMENT_CATEGORY,
      detail: `${plan.description} - Cuota ${index + 1}/${plan.total_installments} (${month})`,
      card_id: plan.card_id,
      installment_id: installmentId,
      date: date.toISOString(),
    };
  });
}

export function installmentProgress(plan: Pick<InstallmentPlan, "first_installment_date" | "total_installments">, today = new Date()) {
  const first = new Date(plan.first_installment_date);
  const total = plan.total_installments;
  let billed = 0;
  while (billed < total && addMonths(first, billed) <= today) billed++;
  const last = addMonths(first, total - 1);
  return { billed, left: total - billed, last, active: last >= today };
}
