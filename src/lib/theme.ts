import { readJson, readStorage, writeStorage } from "./storage.ts";

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
  hue: number;
}

export interface ThemePreset {
  id: string;
  name: string;
  hue: number;
  light: PaletteVars;
  dark: PaletteVars;
}

export interface CustomThemeSettings {
  hue?: number;     // 0-360
  font?: string;    // font option id
  radius?: number;  // rem value
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

function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const ok = (L: number, C: number, h: number) => `oklch(${L} ${C} ${h})`;

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

export function findPreset(id: string | null | undefined): ThemePreset | undefined {
  if (!id) return undefined;
  const resolved = RETIRED_PRESETS[id] ?? id;
  return THEME_PRESETS.find((t) => t.id === resolved);
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
  root.style.setProperty("--sidebar-accent", p.muted);
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

export type ThemeMode = "light" | "dark";

function paletteFor(themeId: string | null | undefined, settings: CustomThemeSettings, mode: ThemeMode) {
  if (themeId === "custom" && settings.hue != null) return generatePaletteFromHue(settings.hue, mode);
  const preset = findPreset(themeId);
  return preset ? preset[mode] : null;
}

export function applyTheme(themeId: string | null | undefined, settings: CustomThemeSettings, mode: ThemeMode) {
  const root = document.documentElement;
  const palette = paletteFor(themeId, settings, mode);
  if (palette) applyPalette(root, palette);
  else clearAllOverrides(root);
  applyFont(settings.font ?? null);
  if (settings.radius != null) root.style.setProperty("--radius", `${settings.radius}rem`);
  else root.style.removeProperty("--radius");
}

export function cacheTheme(themeId: string | null | undefined, settingsJson: string | null | undefined) {
  writeStorage(THEME_CACHE_KEY, themeId || null);
  writeStorage(CUSTOM_SETTINGS_CACHE_KEY, settingsJson || null);
}
