/**
 * Centralized chart color configuration.
 * Uses CSS custom properties so colors adapt to light/dark themes.
 * Access via getComputedStyle(document.documentElement).getPropertyValue('--color-xxx')
 */

function getCSSVar(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Semantic chart colors that respond to the current theme */
export const CHART_COLORS = {
  get income() { return getCSSVar("--color-income") || "#10b981"; },
  get expense() { return getCSSVar("--color-expense") || "#e11d48"; },
  get investment() { return getCSSVar("--color-investment") || "#0ea5e9"; },
  get balance() { return getCSSVar("--color-balance") || "#f59e0b"; },
  get mutedAxis() { return getCSSVar("--color-muted-axis") || "#94a3b8"; },
  get grid() { return getCSSVar("--color-grid") || "#e2e8f0"; },
};

/** Type-to-color mapping for transaction types */
export const TYPE_COLORS = {
  get Ingresos() { return CHART_COLORS.income; },
  get Gastos() { return CHART_COLORS.expense; },
  get Inversiones() { return CHART_COLORS.investment; },
  get Balance() { return CHART_COLORS.balance; },
};

/** Common Recharts tooltip style using theme tokens */
export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "var(--card, #ffffff)",
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: "0.5rem",
  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
  padding: "12px",
  color: "var(--foreground, #0f172a)",
};
