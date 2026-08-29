import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useUserProfile } from "./useUserProfile";

// ── Full palette definition ─────────────────────────────────────────
interface PaletteVars {
  background: string;
  foreground: string;
  card: string;
  primary: string;
  primaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
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

// ── El punto más vivo de cada tono ──────────────────────────────────
// Un tema apagado casi nunca es culpa del tono: es culpa de la
// luminosidad. En OKLCH cada tono alcanza su chroma máximo dentro de sRGB
// a una L distinta — el rosa cerca de 0.63, el amarillo cerca de 0.97, el
// azul recién en 0.45. Fijar la misma L para todos (lo que hacía la
// versión anterior con 0.7) condena al azul y al violeta a un chroma que
// la pantalla ni se molesta en mostrar. Así que primero buscamos ese
// punto — el "cusp" del tono — y recién después elegimos la L final.

const RAD = Math.PI / 180;

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** sRGB (0–1, con gamma) → OKLCH. Matrices de Oklab (Ottosson). */
function rgbToOklch(r: number, g: number, b: number) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), h: ((Math.atan2(B, A) / RAD) % 360 + 360) % 360 };
}

/** hsl(h 100% 50%) → sRGB: la arista más saturada del cubo para ese tono. */
function pureHue(h: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const f = (n: number) => 0.5 - 0.5 * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

/** Diferencia angular más corta, en (-180, 180]. */
function hueDelta(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

/**
 * Luminosidad del cusp: la L a la que el tono alcanza su chroma máximo en
 * sRGB. El tono de HSL y el de OKLCH no coinciden (hsl 240 no es oklch
 * 240), así que iteramos sobre la diferencia hasta caer en el tono pedido
 * — tres pasos dejan el error muy por debajo del grado.
 */
function cuspLightness(hueTarget: number): number {
  const h = ((hueTarget % 360) + 360) % 360;
  let hHsl = h;
  let c = rgbToOklch(...pureHue(hHsl));
  for (let i = 0; i < 3; i++) {
    hHsl = (hHsl + hueDelta(h, c.h) + 360) % 360;
    c = rgbToOklch(...pureHue(hHsl));
  }
  return c.L;
}

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

/**
 * Chroma máximo que entra en sRGB a esa luminosidad y ese tono. Búsqueda
 * binaria sobre el borde real del gamut: aproximarlo por un triángulo se
 * pasa justo en los tonos que más nos importan (verde, magenta) y termina
 * dejando que el navegador recorte por su cuenta.
 */
function maxChroma(L: number, h: number): number {
  let lo = 0, hi = 0.45;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const fits = oklchToLinearRgb(L, mid, h).every((v) => v >= -1e-4 && v <= 1.0001);
    if (fits) lo = mid; else hi = mid;
  }
  return +lo.toFixed(4);
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** El acento del tono h, tan saturado como se pueda dentro de la banda de L legible. */
function vividAccent(h: number, minL: number, maxL: number) {
  const L = +clamp(cuspLightness(h), minL, maxL).toFixed(3);
  const C = maxChroma(L, h);
  return { L, C, css: `oklch(${L} ${C} ${+h.toFixed(1)})` };
}

/** Luminancia relativa (WCAG) de un color OKLCH. */
function relLuminance(L: number, C: number, h: number): number {
  const [r, g, b] = oklchToLinearRgb(L, C, h).map((v) => clamp(v, 0, 1));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

// El acento vive en una banda de luminosidad angosta: sobre negro puede
// irse más arriba que sobre blanco sin dejar de contrastar con el fondo.
const DARK_ACCENT_BAND: [number, number] = [0.62, 0.82];
const LIGHT_ACCENT_BAND: [number, number] = [0.48, 0.72];
// El texto sobre el acento sigue la regla de Rindo — casi blanco, como en
// el rosa original, que apenas pasa de 3:1. Solo se da vuelta a negro
// cuando el tono es tan luminoso que el blanco directamente no se lee.
const MIN_ON_ACCENT_CONTRAST = 3.1;

/**
 * Genera la paleta completa de un tono.
 *
 * La forma es la de Rindo y no se negocia: superficies casi neutras —
 * negro real en oscuro, blanco real en claro, apenas teñidas del tono
 * para que el tema se sienta— y UN acento a chroma máximo. El contraste
 * brutal entre esas dos cosas es lo que hace que el rosa se vea vivo, y
 * es lo que cada tono hereda acá.
 */
export function generatePaletteFromHue(
  hue: number,
  mode: "light" | "dark"
): PaletteVars {
  const h = +(((hue % 360) + 360) % 360).toFixed(1);
  // El ring corre el tono unos grados: el gradiente del sistema vive
  // entre el primary y el ring, y ese corrimiento es lo que lo hace brillar.
  const hRing = (h + 26) % 360;
  const band = mode === "dark" ? DARK_ACCENT_BAND : LIGHT_ACCENT_BAND;
  const primary = vividAccent(h, band[0], band[1]);
  const ring = vividAccent(hRing, band[0], band[1]);
  const onAccent =
    contrast(relLuminance(primary.L, primary.C, h), relLuminance(0.98, 0.015, h)) <
    MIN_ON_ACCENT_CONTRAST
      ? `oklch(0.16 0.04 ${h})`
      : `oklch(0.98 0.015 ${h})`;

  if (mode === "light") {
    return {
      background: `oklch(0.965 0.004 ${h})`,
      foreground: `oklch(0.13 0.012 ${h})`,
      card: `oklch(0.995 0.002 ${h})`,
      primary: primary.css,
      primaryForeground: onAccent,
      muted: `oklch(0.935 0.008 ${h})`,
      mutedForeground: `oklch(0.42 0.02 ${h})`,
      border: `oklch(0.855 0.012 ${h})`,
      input: `oklch(0.855 0.012 ${h})`,
      ring: ring.css,
      sidebar: `oklch(0.955 0.006 ${h})`,
      sidebarBorder: `oklch(0.855 0.012 ${h})`,
      hue: h,
    };
  }
  return {
    background: `oklch(0.098 0.008 ${h})`,
    foreground: `oklch(0.985 0.004 ${h})`,
    card: `oklch(0.141 0.011 ${h})`,
    primary: primary.css,
    primaryForeground: onAccent,
    muted: `oklch(0.21 0.014 ${h})`,
    mutedForeground: `oklch(0.705 0.024 ${h})`,
    border: `oklch(0.28 0.016 ${h})`,
    input: `oklch(0.25 0.016 ${h})`,
    ring: ring.css,
    sidebar: `oklch(0.12 0.011 ${h})`,
    sidebarBorder: `oklch(0.25 0.016 ${h})`,
    hue: h,
  };
}

// ── Theme presets ───────────────────────────────────────────────────
// Un preset ya no es una paleta escrita a mano: es un tono. Todo lo demás
// —el negro de las superficies, la saturación del acento, el gradiente—
// sale de la misma fórmula que el slider custom, así que ningún tema
// puede quedarse a medio camino. Los tonos están repartidos por la rueda
// para que ninguno se confunda con el vecino ni con el rosa de Rindo.

const PRESET_HUES: { id: string; name: string; hue: number }[] = [
  { id: "atardecer", name: "Atardecer", hue: 45 },
  { id: "arena", name: "Arena", hue: 85 },
  { id: "bosque", name: "Bosque", hue: 148 },
  { id: "artico", name: "Ártico", hue: 196 },
  { id: "oceano", name: "Océano", hue: 240 },
  { id: "medianoche", name: "Medianoche", hue: 275 },
  { id: "lavanda", name: "Lavanda", hue: 305 },
  { id: "cereza", name: "Cereza", hue: 340 },
];

export const THEME_PRESETS: ThemePreset[] = PRESET_HUES.map(({ id, name, hue }) => ({
  id,
  name,
  hue,
  light: generatePaletteFromHue(hue, "light"),
  dark: generatePaletteFromHue(hue, "dark"),
}));

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
  "--ring",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--accent-gradient",
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
  root.style.setProperty("--ring", p.ring);
  root.style.setProperty("--sidebar", p.sidebar);
  root.style.setProperty("--sidebar-foreground", p.foreground);
  root.style.setProperty("--sidebar-primary", p.primary);
  root.style.setProperty("--sidebar-primary-foreground", p.primaryForeground);
  root.style.setProperty("--sidebar-accent", p.muted);
  root.style.setProperty("--sidebar-accent-foreground", p.foreground);
  root.style.setProperty("--sidebar-border", p.sidebarBorder);
  root.style.setProperty("--sidebar-ring", p.ring);
  root.style.setProperty(
    "--accent-gradient",
    `linear-gradient(135deg, ${p.primary}, ${p.ring})`
  );

  // Update meta theme-color for browser/PWA chrome
  setMetaThemeColor(p.sidebar);

  // Los gráficos son el mismo acento escalonado en luminosidad, cada
  // escalón tan saturado como permita su altura: una rampa viva, no cinco
  // grises teñidos.
  [0.84, 0.73, 0.62, 0.51, 0.41].forEach((L, i) => {
    root.style.setProperty(
      `--chart-${i + 1}`,
      `oklch(${L} ${maxChroma(L, p.hue)} ${p.hue})`
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

  const preset = THEME_PRESETS.find((t) => t.id === themeId);
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
    } catch {}

    // Apply color theme
    if (themeId === "custom" && customSettings.hue != null) {
      const mode = resolvedTheme === "dark" ? "dark" : "light";
      applyPalette(root, generatePaletteFromHue(customSettings.hue, mode));
    } else if (themeId) {
      const preset = THEME_PRESETS.find((t) => t.id === themeId);
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
