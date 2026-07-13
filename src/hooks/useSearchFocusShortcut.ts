import { RefObject, useEffect } from "react";

// Elementos donde Enter/Space ya tienen significado propio — no robarles el foco
const INTERACTIVE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "a",
  '[contenteditable="true"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="combobox"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="slider"]',
].join(", ");

/**
 * Keyboard-first: al presionar Enter, Space o "/" en la página (fuera de
 * inputs, botones o modales) enfoca la barra de búsqueda y selecciona su
 * contenido para empezar a escribir de inmediato.
 */
export function useSearchFocusShortcut(inputRef: RefObject<HTMLInputElement>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "Enter" && e.key !== " " && e.key !== "/") return;

      const target = e.target as HTMLElement;
      if (target.closest?.(INTERACTIVE_SELECTOR)) return;

      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inputRef]);
}
