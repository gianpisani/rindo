/**
 * El color de una categoría es su identidad: aparece donde aparece ella, como
 * un tinte suave detrás del emoji o del nombre. El texto sigue en foreground,
 * así el color acompaña sin volverse arcoíris. Sin color, un gris neutro.
 */
export const tintColor = (color?: string | null, amount = 22) =>
  `color-mix(in oklch, ${color || "var(--muted-foreground)"} ${amount}%, transparent)`;

/** Fondo del ícono de una categoría. */
export const tint = (color?: string | null) => ({ background: tintColor(color) });

/**
 * Tinta legible sobre un color plano (el plástico de una tarjeta): oscura
 * sobre los colores claros (amarillo, verde, cian), blanca sobre el resto.
 */
export const inkOn = (hex?: string | null) => {
  const m = hex?.match(/^#([0-9a-f]{6})$/i);
  if (!m) return undefined;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? "#0a0a0a" : undefined;
};
