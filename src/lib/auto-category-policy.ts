export const ANALYZING_CATEGORY = '⚡ Analizando...';

export function shouldCategorize(transaction: { detail?: string | null; type: string; category_name: string }) {
  return ['Gasto', 'Ingreso', 'Inversión'].includes(transaction.type) &&
    (transaction.detail?.trim().length ?? 0) >= 3 &&
    ['', ANALYZING_CATEGORY].includes(transaction.category_name);
}

/** Preserve compatibility until the category-context migration is installed. */
export function withManualCategorySource<T extends { category_name?: string }>(values: T, enabled: boolean) {
  if (!enabled || values.category_name === undefined) return values;
  return { ...values, category_source: values.category_name && !['Sin categoría', ANALYZING_CATEGORY].includes(values.category_name) ? 'manual' : null };
}
