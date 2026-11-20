import { readJson, readStorage, writeStorage } from "./storage.ts";

export type ThemeMode = "light" | "dark";

export type Surface = "neutral" | "tinted";

export interface SurfaceVars {
  background: string;
  foreground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  sidebar: string;
  sidebarAccent: string;
  sidebarBorder: string;
}

export interface AccentVars {
  primary: string;
  primaryForeground: string;
  hue: number;
}

export type PaletteVars = SurfaceVars & AccentVars;

export interface CustomThemeSettings {
  hue?: number;
  font?: string;
  radius?: number;
  surface?: Surface;
}

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

const RAD = Math.PI / 180;

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

function maxChroma(L: number, h: number): number {
  let lo = 0, hi = 0.45;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const fits = oklchToLinearRgb(L, mid, h).every((v) => v >= -1e-4 && v <= 1.0001);
    if (fits) lo = mid; else hi = mid;
  }
  return +lo.toFixed(4);
}

function relLuminance(L: number, C: number, h: number): number {
  const [r, g, b] = oklchToLinearRgb(L, C, h).map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseOklch(color: string): [number, number, number] {
  const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(color);
  if (!match) throw new Error(`Color OKLCH inválido: ${color}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function oklchContrast(a: string, b: string): number {
  const ya = relLuminance(...parseOklch(a));
  const yb = relLuminance(...parseOklch(b));
  const [hi, lo] = ya > yb ? [ya, yb] : [yb, ya];
  return (hi + 0.05) / (lo + 0.05);
}

const ok = (L: number, C: number, h: number) => `oklch(${L} ${C} ${h})`;

const normalizeHue = (hue: number) => +(((hue % 360) + 360) % 360).toFixed(1);

export const NEUTRAL_SURFACES: Record<ThemeMode, SurfaceVars> = {
  light: {
    background: "oklch(0.965 0.002 286)",
    foreground: "oklch(0.13 0.005 285.823)",
    card: "oklch(0.995 0 0)",
    muted: "oklch(0.935 0.003 286)",
    mutedForeground: "oklch(0.355 0.016 285.938)",
    border: "oklch(0.835 0.008 286)",
    input: "oklch(0.835 0.008 286)",
    sidebar: "oklch(0.955 0.002 286)",
    sidebarAccent: "oklch(0.91 0.004 286)",
    sidebarBorder: "oklch(0.835 0.008 286)",
  },
  dark: {
    background: "oklch(0.098 0.005 285.823)",
    foreground: "oklch(0.985 0 0)",
    card: "oklch(0.141 0.005 285.823)",
    muted: "oklch(0.21 0.006 285.885)",
    mutedForeground: "oklch(0.705 0.015 286.067)",
    border: "oklch(1 0 0 / 8%)",
    input: "oklch(1 0 0 / 12%)",
    sidebar: "oklch(0.12 0.005 285.823)",
    sidebarAccent: "oklch(0.21 0.006 285.885)",
    sidebarBorder: "oklch(1 0 0 / 8%)",
  },
};

export const RINDO_ACCENT: Record<ThemeMode, AccentVars> = {
  light: { primary: "oklch(0.586 0.253 17.585)", primaryForeground: "oklch(0.969 0.015 12.422)", hue: 17.6 },
  dark: { primary: "oklch(0.645 0.246 16.439)", primaryForeground: "oklch(0.969 0.015 12.422)", hue: 16.4 },
};

const TINTED = {
  light: {
    background: [0.955, 0.032],
    card: [0.99, 0.012],
    sidebar: [0.935, 0.04],
    muted: [0.91, 0.045],
    border: [0.855, 0.05],
    foreground: [0.22, 0.045],
    mutedForeground: [0.46, 0.07],
    accentL: 0.52,
    accentMaxC: 0.23,
  },
  dark: {
    background: [0.18, 0.042],
    card: [0.225, 0.048],
    sidebar: [0.16, 0.04],
    muted: [0.28, 0.055],
    border: [0.33, 0.06],
    foreground: [0.955, 0.015],
    mutedForeground: [0.74, 0.055],
    accentL: 0.72,
    accentMaxC: 0.2,
  },
} as const;

export function tintedSurfaces(hue: number, mode: ThemeMode): SurfaceVars {
  const h = normalizeHue(hue);
  const t = TINTED[mode];
  const surface = ([L, C]: readonly [number, number]) => ok(L, Math.min(C, maxChroma(L, h)), h);
  return {
    background: surface(t.background),
    foreground: surface(t.foreground),
    card: surface(t.card),
    muted: surface(t.muted),
    mutedForeground: surface(t.mutedForeground),
    border: surface(t.border),
    input: surface(t.border),
    sidebar: surface(t.sidebar),
    sidebarAccent: surface(t.muted),
    sidebarBorder: surface(t.border),
  };
}

export function generatedAccent(hue: number, mode: ThemeMode): AccentVars {
  const h = normalizeHue(hue);
  const t = TINTED[mode];
  const primary = ok(t.accentL, Math.min(t.accentMaxC, maxChroma(t.accentL, h)), h);
  const light = ok(0.985, 0.01, h);
  const dark = ok(0.2, 0.03, h);
  return {
    primary,
    primaryForeground: oklchContrast(primary, light) >= oklchContrast(primary, dark) ? light : dark,
    hue: h,
  };
}

interface AccentPreset {
  id: string;
  name: string;
  hue: number;
  accentHue?: number;
}

export const ACCENT_PRESETS: AccentPreset[] = [
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

export function findPreset(id: string | null | undefined): AccentPreset | undefined {
  if (!id) return undefined;
  const resolved = RETIRED_PRESETS[id] ?? id;
  return ACCENT_PRESETS.find((t) => t.id === resolved);
}

export const defaultSurface = (themeId: string | null | undefined): Surface => (themeId ? "tinted" : "neutral");

function accentFor(themeId: string | null | undefined, settings: CustomThemeSettings, mode: ThemeMode): AccentVars {
  if (themeId === "custom" && settings.hue != null) return generatedAccent(settings.hue, mode);
  const preset = findPreset(themeId);
  return preset ? generatedAccent(preset.accentHue ?? preset.hue, mode) : RINDO_ACCENT[mode];
}

function tintHueFor(themeId: string | null | undefined, settings: CustomThemeSettings, accent: AccentVars): number {
  if (themeId === "custom" && settings.hue != null) return settings.hue;
  return findPreset(themeId)?.hue ?? accent.hue;
}

export function resolvePalette(
  themeId: string | null | undefined,
  settings: CustomThemeSettings,
  mode: ThemeMode,
): PaletteVars {
  const accent = accentFor(themeId, settings, mode);
  const surface = settings.surface ?? defaultSurface(themeId);
  const surfaces = surface === "neutral" ? NEUTRAL_SURFACES[mode] : tintedSurfaces(tintHueFor(themeId, settings, accent), mode);
  return { ...surfaces, ...accent };
}

function isStockLook(themeId: string | null | undefined, settings: CustomThemeSettings) {
  return !findPreset(themeId) && !(themeId === "custom" && settings.hue != null) && (settings.surface ?? "neutral") === "neutral";
}

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
  root.style.setProperty("--sidebar-accent", p.sidebarAccent);
  root.style.setProperty("--sidebar-accent-foreground", p.foreground);
  root.style.setProperty("--sidebar-border", p.sidebarBorder);

  setMetaThemeColor(p.sidebar);

  [0.84, 0.73, 0.62, 0.51, 0.41].forEach((L, i) => {
    root.style.setProperty(
      `--chart-${i + 1}`,
      `oklch(${L} ${Math.min(0.15, maxChroma(L, p.hue))} ${p.hue})`
    );
  });
}

function applyFont(fontId: string | null) {
  const fontOption = FONT_OPTIONS.find((f) => f.id === fontId);
  document.body.style.fontFamily = fontOption && fontOption.id !== "default" ? fontOption.family : "";
}

const THEME_CACHE_KEY = "rindo-theme-id";
const CUSTOM_SETTINGS_CACHE_KEY = "rindo-custom-settings";

export const getCachedThemeId = () => readStorage(THEME_CACHE_KEY);

export const getCachedCustomSettings = () => readJson<CustomThemeSettings>(CUSTOM_SETTINGS_CACHE_KEY);

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

export function applyTheme(themeId: string | null | undefined, settings: CustomThemeSettings, mode: ThemeMode) {
  const root = document.documentElement;
  if (isStockLook(themeId, settings)) clearAllOverrides(root);
  else applyPalette(root, resolvePalette(themeId, settings, mode));
  applyFont(settings.font ?? null);
  if (settings.radius != null) root.style.setProperty("--radius", `${settings.radius}rem`);
  else root.style.removeProperty("--radius");
}

export function cacheTheme(themeId: string | null | undefined, settingsJson: string | null | undefined) {
  writeStorage(THEME_CACHE_KEY, themeId || null);
  writeStorage(CUSTOM_SETTINGS_CACHE_KEY, settingsJson || null);
}
