// Origen de una transacción: de dónde salió la fila.
//
// La señal vive en `transactions.import_source`, no en el texto de `detail`.
// Antes el badge se infería de un prefijo 🤖 dentro del detalle, que es ambiguo
// (lo escribían tanto process-email-v2 como bank-sync) y frágil (el detalle es
// editable por el usuario). Las funciones de importación siguen existiendo pero
// ya no anteponen el emoji; `getCleanDetail` limpia el que quedó en las filas
// históricas.

export type ImportSource = "manual" | "email" | "bank-sync" | "wallet";

interface ImportSourceBadge {
  emoji: string;
  label: string;
}

export const IMPORT_SOURCE_BADGE: Record<ImportSource, ImportSourceBadge> = {
  email: { emoji: "✉️", label: "Importado desde el mail del banco" },
  "bank-sync": { emoji: "🤖", label: "Importado por sincronización bancaria" },
  wallet: { emoji: "📱", label: "Importado desde la wallet del iPhone" },
  manual: { emoji: "✋", label: "Ingresado a mano" },
};

/**
 * Badge del origen, o undefined si es desconocido: las filas anteriores a la
 * columna quedaron en NULL a propósito y no se les inventa un origen.
 */
export function getImportSourceBadge(
  source: string | null | undefined,
): ImportSourceBadge | undefined {
  if (!source) return undefined;
  return IMPORT_SOURCE_BADGE[source as ImportSource];
}

/**
 * Quita el prefijo de origen que las funciones de importación dejaron dentro
 * del texto de las filas antiguas. Mismo regex que usa el backend en
 * supabase/functions/_shared/email-notification.ts.
 */
export function getCleanDetail(detail: string | null | undefined): string {
  if (!detail) return "";
  return detail.replace(/^[🤖📱]\s*/u, "").trim();
}
