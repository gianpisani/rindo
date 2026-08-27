// ── Magnificación tipo dock de macOS ────────────────────────
//
// La palabra bajo el cursor crece y sus vecinas se apartan.
//
// El truco está en cómo se aparta cada una. Con márgenes reales la línea se
// ensancha y la última palabra se va al renglón de abajo, que es horrible. Así
// que nadie cambia de tamaño en el layout: la palabra crece con `scale` y las
// demás se corren con `translateX`. Ninguna de las dos transformaciones afecta
// al flujo, así que la línea jamás se reacomoda —igual que el dock, que tampoco
// mueve el resto de la pantalla.

/** Cuánto crece la señalada, su vecina y la siguiente. */
export const DOCK_SCALE = [1.3, 1.12, 1.04];

/** Más suave, para texto que ya es grande: el mismo gesto sin aspaviento. */
export const DOCK_SCALE_LARGE = [1.16, 1.06, 1.02];

export interface DockLayout {
  scale: number[];
  shift: number[];
}

export interface DockPart {
  isWord: boolean;
  /** Número de palabra dentro de la línea; -1 si es un espacio o un signo. */
  ord: number;
}

/**
 * Calcula, para cada trozo de la línea, cuánto crece y cuánto se corre.
 *
 * El desplazamiento de un trozo es el ancho extra que aparece entre su centro
 * y el centro de la palabra señalada: la mitad del extra de la señalada, más
 * el extra completo de las que quedan en medio, más la mitad del suyo propio.
 */
export function computeDock(
  parts: DockPart[],
  widths: number[],
  hoveredOrd: number,
  steps: number[] = DOCK_SCALE
): DockLayout {
  const scale = parts.map((part) =>
    part.isWord ? (steps[Math.abs(hoveredOrd - part.ord)] ?? 1) : 1
  );
  const extra = scale.map((s, i) => (s - 1) * (widths[i] ?? 0));

  const center = parts.findIndex((p) => p.isWord && p.ord === hoveredOrd);
  const shift = parts.map(() => 0);
  if (center === -1) return { scale, shift };

  let running = extra[center] / 2;
  for (let i = center + 1; i < parts.length; i++) {
    shift[i] = running + extra[i] / 2;
    running += extra[i];
  }

  running = extra[center] / 2;
  for (let i = center - 1; i >= 0; i--) {
    shift[i] = -(running + extra[i] / 2);
    running += extra[i];
  }

  return { scale, shift };
}

/** Parte una línea en trozos numerando solo las palabras. */
export function numberWords<T extends { isWord: boolean }>(
  parts: T[]
): (T & { ord: number })[] {
  let ord = -1;
  return parts.map((part) => {
    if (part.isWord) ord += 1;
    return { ...part, ord: part.isWord ? ord : -1 };
  });
}
