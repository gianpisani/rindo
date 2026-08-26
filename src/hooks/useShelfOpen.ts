import { useCallback, useState } from "react";

const STORAGE_PREFIX = "rindo.shelf.";

/**
 * Colapsar una estantería es una preferencia, no un estado del momento: si la
 * cerraste es porque hoy no te interesa mirarla, y volver del estudio no debería
 * abrírtela de nuevo. Por eso se recuerda en el dispositivo.
 */
export function useShelfOpen(storageKey: string, fallback = true) {
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + storageKey);
      return stored === null ? fallback : stored === "1";
    } catch {
      return fallback;
    }
  });

  const set = useCallback(
    (next: boolean) => {
      setOpen(next);
      try {
        localStorage.setItem(STORAGE_PREFIX + storageKey, next ? "1" : "0");
      } catch {
        /* modo privado: se pierde la preferencia, no pasa nada */
      }
    },
    [storageKey]
  );

  return [open, set] as const;
}
