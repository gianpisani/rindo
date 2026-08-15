import { useEffect } from "react";
import { create } from "zustand";

interface KeyboardCaptureState {
  /** Cuántas vistas están pidiendo el teclado para sí mismas. */
  holders: number;
  acquire: () => void;
  release: () => void;
}

const useKeyboardCaptureStore = create<KeyboardCaptureState>((set) => ({
  holders: 0,
  acquire: () => set((s) => ({ holders: s.holders + 1 })),
  release: () => set((s) => ({ holders: Math.max(0, s.holders - 1) })),
}));

/**
 * Toma el teclado para la vista actual mientras esté montada.
 *
 * El estudio de aprendizaje usa Espacio, flechas y letras sueltas. Sin esto,
 * apretar `p` activaría el modo privado y `n` abriría el drawer de gastos en
 * plena sesión de estudio. Es un contador y no un booleano para que dos vistas
 * anidadas no se pisen al desmontarse.
 */
export function useCaptureKeyboard(active = true) {
  const acquire = useKeyboardCaptureStore((s) => s.acquire);
  const release = useKeyboardCaptureStore((s) => s.release);

  useEffect(() => {
    if (!active) return;
    acquire();
    return release;
  }, [active, acquire, release]);
}

/** Lo consultan los atajos globales para hacerse a un lado. */
export function useKeyboardIsCaptured() {
  return useKeyboardCaptureStore((s) => s.holders > 0);
}
