import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useUserProfile } from "./useUserProfile";

// ── Full palette definition ─────────────────────────────────────────
export interface PaletteVars {
  background: string;
  foreground: string;
  card: string;
  primary: string;
  primaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  sidebar: string;
  sidebarBorder: string;
  /** Tono OKLCH del acento — de acá salen los colores de los gráficos. */
  hue: number;
}

export interface ThemePreset {
  id: string;
  name: string;
  hue: number;
  light: PaletteVars;
  dark: PaletteVars;
}

// ── Custom theme settings (stored as JSON in accent_color_2) ────────
export interface CustomThemeSettings {
  hue?: number;     // 0-360
  font?: string;    // font option id
  radius?: number;  // rem value
}

// ── Font options ────────────────────────────────────────────────────
export const FONT_OPTIONS = [
  { id: "default", name: "Jakarta", family: "'Plus Jakarta Sans', sans-serif" },
  { id: "inter", name: "Inter", family: "'Inter', sans-serif" },
  { id: "dm-sans", name: "DM Sans", family: "'DM Sans', sans-serif" },
  { id: "nunito", name: "Nunito", family: "'Nunito', sans-serif" },
  { id: "space-grotesk", name: "Space Grotesk", family: "'Space Grotesk', sans-serif" },
  { id: "outfit", name: "Outfit", family: "'Outfit', sans-serif" },
  { id: "sora", name: "Sora", family: "'Sora', sans-serif" },
  { id: "bricolage", name: "Bricolage", family: "'Bricolage Grotesque', sans-serif" },
];

// ── Color en OKLCH ──────────────────────────────────────────────────
// Un tema es un tono repartido en dos dosis: un susurro en los neutros
// (fondo, tarjetas, bordes, texto) para que la app entera se sienta de
// ese color sin volverse caramelo, y un acento firme —no chillón— para
// la navegación activa y los gráficos.

const RAD = Math.PI / 180;

/** OKLCH → sRGB lineal, sin gamma: alcanza para saber si el color entra. */
function oklchToLinearRgb(L: number, C: number, h: number): [number, number, number] {
  const a = C * Math.cos(h * RAD), b = C * Math.sin(h * RAD);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Chroma máximo que entra en sRGB a esa luminosidad y ese tono. */
function maxChroma(L: number, h: number): number {
  let lo = 0, hi = 0.45;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const fits = oklchToLinearRgb(L, mid, h).every((v) => v >= -1e-4 && v <= 1.0001);
    if (fits) lo = mid; else hi = mid;
  }
  return +lo.toFixed(4);
}

/** Luminancia relativa (WCAG) de un color OKLCH. */
function relLuminance(L: number, C: number, h: number): number {
  const [r, g, b] = oklchToLinearRgb(L, C, h).map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const ok = (L: number, C: number, h: number) => `oklch(${L} ${C} ${h})`;

/**
 * Luz y tono de cada superficie, iguales para todos los temas: ningún
 * tema queda más oscuro ni con menos contraste que otro. El segundo
 * número es cuánto tono lleva: un susurro en el fondo, casi nada en las
 * tarjetas (se levantan del fondo por luz, no por color) y algo más en
 * el texto secundario para que no sea gris sobre gris. Medido: texto y
 * texto secundario pasan 4.5:1 sobre fondo, tarjeta y muted en ambos modos.
 */
const SURFACES = {
  light: {
    background: [0.962, 0.012],
    card: [0.993, 0.004],
    sidebar: [0.948, 0.014],
    muted: [0.928, 0.016],
    border: [0.878, 0.018],
    foreground: [0.22, 0.022],
    mutedForeground: [0.475, 0.035],
    accentL: 0.54,
    accentMaxC: 0.15,
  },
  dark: {
    background: [0.185, 0.016],
    card: [0.225, 0.018],
    sidebar: [0.165, 0.016],
    muted: [0.275, 0.02],
    border: [0.32, 0.022],
    foreground: [0.955, 0.008],
    mutedForeground: [0.735, 0.03],
    accentL: 0.74,
    accentMaxC: 0.14,
  },
} as const;

/**
 * La paleta completa de un tono. `accentHue` deja que un tema tenga
 * neutros de un tono y acento de un vecino (arena con acento ocre);
 * por defecto son el mismo.
 */
export function generatePaletteFromHue(
  hue: number,
  mode: "light" | "dark",
  accentHue: number = hue
): PaletteVars {
  const h = +(((hue % 360) + 360) % 360).toFixed(1);
  const ah = +(((accentHue % 360) + 360) % 360).toFixed(1);
  const s = SURFACES[mode];
  const surface = ([L, C]: readonly [number, number]) => ok(L, C, h);

  const accentC = Math.min(s.accentMaxC, maxChroma(s.accentL, ah));
  const accentY = relLuminance(s.accentL, accentC, ah);
  // Texto sobre el acento: claro u oscuro, el que más contraste.
  const light = ok(0.985, 0.01, ah);
  const dark = ok(0.2, 0.03, ah);
  const onAccent =
    contrast(accentY, relLuminance(0.985, 0.01, ah)) >=
    contrast(accentY, relLuminance(0.2, 0.03, ah))
      ? light
      : dark;

  return {
    background: surface(s.background),
    foreground: surface(s.foreground),
    card: surface(s.card),
    primary: ok(s.accentL, accentC, ah),
    primaryForeground: onAccent,
    muted: surface(s.muted),
    mutedForeground: surface(s.mutedForeground),
    border: surface(s.border),
    input: surface(s.border),
    sidebar: surface(s.sidebar),
    sidebarBorder: surface(s.border),
    hue: ah,
  };
}

// ── Theme presets ───────────────────────────────────────────────────
// Seis tonos repartidos por la rueda. Los ids retirados apuntan al
// vecino más parecido, así nadie pierde el tema que tenía guardado.

const PRESETS: { id: string; name: string; hue: number; accentHue?: number }[] = [
  { id: "atardecer", name: "Atardecer", hue: 45, accentHue: 38 },
  { id: "arena", name: "Arena", hue: 80, accentHue: 65 },
  { id: "bosque", name: "Bosque", hue: 150 },
  { id: "artico", name: "Ártico", hue: 205 },
  { id: "oceano", name: "Océano", hue: 255 },
  { id: "lavanda", name: "Lavanda", hue: 305 },
];

const RETIRED_PRESETS: Record<string, string> = {
  medianoche: "oceano",
  cereza: "lavanda",
};

export const THEME_PRESETS: ThemePreset[] = PRESETS.map(({ id, name, hue, accentHue }) => ({
  id,
  name,
  hue,
  light: generatePaletteFromHue(hue, "light", accentHue),
  dark: generatePaletteFromHue(hue, "dark", accentHue),
}));

/** El preset de un id guardado, incluidos los retirados. */
export function findPreset(id: string | null | undefined): ThemePreset | undefined {
  if (!id) return undefined;
  const resolved = RETIRED_PRESETS[id] ?? id;
  return THEME_PRESETS.find((t) => t.id === resolved);
}

// ── CSS variable names to override ──────────────────────────────────

const CSS_VARS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--border",
  "--input",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
];

function setMetaThemeColor(color: string) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute("content", color);
  });
}

function clearAllOverrides(root: HTMLElement) {
  for (const v of CSS_VARS) {
    root.style.removeProperty(v);
  }
  root.style.removeProperty("--radius");
  document.body.style.fontFamily = "";
  setMetaThemeColor("#000000");
}

function applyPalette(root: HTMLElement, p: PaletteVars) {
  root.style.setProperty("--background", p.background);
  root.style.setProperty("--foreground", p.foreground);
  root.style.setProperty("--card", p.card);
  root.style.setProperty("--card-foreground", p.foreground);
  root.style.setProperty("--popover", p.card);
  root.style.setProperty("--popover-foreground", p.foreground);
  root.style.setProperty("--primary", p.primary);
  root.style.setProperty("--primary-foreground", p.primaryForeground);
  root.style.setProperty("--secondary", p.muted);
  root.style.setProperty("--secondary-foreground", p.foreground);
  root.style.setProperty("--muted", p.muted);
  root.style.setProperty("--muted-foreground", p.mutedForeground);
  root.style.setProperty("--accent", p.muted);
  root.style.setProperty("--accent-foreground", p.foreground);
  root.style.setProperty("--border", p.border);
  root.style.setProperty("--input", p.input);
  root.style.setProperty("--sidebar", p.sidebar);
  root.style.setProperty("--sidebar-foreground", p.foreground);
  root.style.setProperty("--sidebar-primary", p.primary);
  root.style.setProperty("--sidebar-primary-foreground", p.primaryForeground);
  root.style.setProperty("--sidebar-accent", p.muted);
  root.style.setProperty("--sidebar-accent-foreground", p.foreground);
  root.style.setProperty("--sidebar-border", p.sidebarBorder);

  // Update meta theme-color for browser/PWA chrome
  setMetaThemeColor(p.sidebar);

  // Los gráficos son el mismo acento escalonado en luminosidad, con el
  // mismo tope de saturación que el acento: una rampa firme, no caramelo.
  [0.84, 0.73, 0.62, 0.51, 0.41].forEach((L, i) => {
    root.style.setProperty(
      `--chart-${i + 1}`,
      `oklch(${L} ${Math.min(0.15, maxChroma(L, p.hue))} ${p.hue})`
    );
  });
}

// ── Public helpers (used by OnboardingModal for live preview) ────────

export function applyThemePreview(
  themeId: string | null,
  mode: "light" | "dark",
  customSettings?: CustomThemeSettings | null
) {
  const root = document.documentElement;

  if (themeId === "custom" && customSettings?.hue != null) {
    applyPalette(root, generatePaletteFromHue(customSettings.hue, mode));
    return;
  }

  if (!themeId) {
    clearAllOverrides(root);
    // Re-apply font/radius if they exist
    if (customSettings?.font) applyFontPreview(customSettings.font);
    if (customSettings?.radius != null) applyRadiusPreview(customSettings.radius);
    return;
  }

  const preset = findPreset(themeId);
  if (!preset) {
    clearAllOverrides(root);
    return;
  }
  applyPalette(root, mode === "dark" ? preset.dark : preset.light);
}

export function applyFontPreview(fontId: string | null) {
  const fontOption = FONT_OPTIONS.find((f) => f.id === fontId);
  if (fontOption && fontOption.id !== "default") {
    document.body.style.fontFamily = fontOption.family;
  } else {
    document.body.style.fontFamily = "";
  }
}

export function applyRadiusPreview(radius: number) {
  document.documentElement.style.setProperty("--radius", `${radius}rem`);
}

export function clearThemeOverrides() {
  clearAllOverrides(document.documentElement);
}

// ── localStorage cache keys ─────────────────────────────────────────
const THEME_CACHE_KEY = "rindo-theme-id";
const CUSTOM_SETTINGS_CACHE_KEY = "rindo-custom-settings";

export function getCachedThemeId(): string | null {
  try {
    return localStorage.getItem(THEME_CACHE_KEY);
  } catch {
    return null;
  }
}

export function getCachedCustomSettings(): CustomThemeSettings | null {
  try {
    const raw = localStorage.getItem(CUSTOM_SETTINGS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Parse custom settings from profile ──────────────────────────────
export function parseCustomSettings(
  raw: string | null | undefined
): CustomThemeSettings {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useCustomTheme() {
  const { profile } = useUserProfile();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    const themeId = profile?.accent_color_1;
    const customSettings = parseCustomSettings(profile?.accent_color_2);

    // Cache for instant load next time
    try {
      if (themeId) localStorage.setItem(THEME_CACHE_KEY, themeId);
      else localStorage.removeItem(THEME_CACHE_KEY);

      const settingsJson = profile?.accent_color_2;
      if (settingsJson) localStorage.setItem(CUSTOM_SETTINGS_CACHE_KEY, settingsJson);
      else localStorage.removeItem(CUSTOM_SETTINGS_CACHE_KEY);
    } catch {
      // localStorage no disponible (modo privado); se ignora el caché
    }

    // Apply color theme
    if (themeId === "custom" && customSettings.hue != null) {
      const mode = resolvedTheme === "dark" ? "dark" : "light";
      applyPalette(root, generatePaletteFromHue(customSettings.hue, mode));
    } else if (themeId) {
      const preset = findPreset(themeId);
      if (preset) {
        const palette =
          resolvedTheme === "dark" ? preset.dark : preset.light;
        applyPalette(root, palette);
      } else {
        clearAllOverrides(root);
      }
    } else {
      clearAllOverrides(root);
    }

    // Apply font (works with any color theme)
    applyFontPreview(customSettings.font ?? null);

    // Apply radius (works with any color theme)
    if (customSettings.radius != null) {
      root.style.setProperty("--radius", `${customSettings.radius}rem`);
    } else {
      root.style.removeProperty("--radius");
    }
  }, [profile?.accent_color_1, profile?.accent_color_2, resolvedTheme]);
}
