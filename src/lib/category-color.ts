export const tintColor = (color?: string | null, amount = 22) =>
  `color-mix(in oklch, ${color || "var(--muted-foreground)"} ${amount}%, transparent)`;

export const tint = (color?: string | null) => ({ background: tintColor(color) });

export const inkOn = (hex?: string | null) => {
  const m = hex?.match(/^#([0-9a-f]{6})$/i);
  if (!m) return undefined;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (y + 0.05) / 0.05 >= 1.05 / (y + 0.05) ? "#000" : "#fff";
};
