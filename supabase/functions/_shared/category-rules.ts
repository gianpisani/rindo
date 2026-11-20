export const UNCATEGORIZED = 'Sin categoría'
const ANALYZING = '⚡ Analizando...'
export const PENDING_CATEGORIES = [UNCATEGORIZED, ANALYZING]
export const PENDING_CATEGORIES_FILTER = `(${PENDING_CATEGORIES.map(name => `"${name}"`).join(',')})`
export const CATEGORIZABLE_TYPES = ['Gasto', 'Ingreso', 'Inversión']
