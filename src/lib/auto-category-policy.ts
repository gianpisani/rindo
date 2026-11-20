export const ANALYZING_CATEGORY = '⚡ Analizando...';
export const UNCATEGORIZED = 'Sin categoría';

const CATEGORIZABLE_TYPES = ['Gasto', 'Ingreso', 'Inversión'];
const MIN_DETAIL_LENGTH = 3;

export function shouldCategorize(transaction: { detail?: string | null; type: string; category_name: string }) {
  return CATEGORIZABLE_TYPES.includes(transaction.type) &&
    (transaction.detail?.trim().length ?? 0) >= MIN_DETAIL_LENGTH &&
    ['', ANALYZING_CATEGORY].includes(transaction.category_name);
}

const isChosenCategory = (name: string) => name !== '' && name !== UNCATEGORIZED && name !== ANALYZING_CATEGORY;

export function withManualCategorySource<T extends { category_name?: string }>(values: T) {
  if (values.category_name === undefined) return values;
  return { ...values, category_source: isChosenCategory(values.category_name) ? 'manual' : null };
}
