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
}

export interface ThemePreset {
  id: string;
  name: string;
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

// ── Generate palette from any hue ───────────────────────────────────
export function generatePaletteFromHue(
  hue: number,
  mode: "light" | "dark"
): PaletteVars {
  const h = ((hue % 360) + 360) % 360;
  if (mode === "light") {
    return {
      background: `oklch(0.97 0.01 ${h})`,
      foreground: `oklch(0.18 0.04 ${h})`,
      card: `oklch(0.99 0.005 ${h})`,
      primary: `oklch(0.55 0.2 ${h})`,
      primaryForeground: `oklch(0.98 0.005 ${h})`,
      muted: `oklch(0.93 0.02 ${h})`,
      mutedForeground: `oklch(0.5 0.04 ${h})`,
      border: `oklch(0.88 0.025 ${h})`,
      input: `oklch(0.88 0.025 ${h})`,
      ring: `oklch(0.6 0.18 ${h + 20})`,
      sidebar: `oklch(0.95 0.015 ${h})`,
      sidebarBorder: `oklch(0.88 0.025 ${h})`,
    };
  }
  return {
    background: `oklch(0.14 0.03 ${h})`,
    foreground: `oklch(0.93 0.01 ${h})`,
    card: `oklch(0.17 0.035 ${h})`,
    primary: `oklch(0.7 0.17 ${h})`,
    primaryForeground: `oklch(0.13 0.03 ${h})`,
    muted: `oklch(0.22 0.03 ${h})`,
    mutedForeground: `oklch(0.65 0.04 ${h})`,
    border: `oklch(0.28 0.03 ${h})`,
    input: `oklch(0.25 0.03 ${h})`,
    ring: `oklch(0.6 0.15 ${h + 20})`,
    sidebar: `oklch(0.12 0.035 ${h})`,
    sidebarBorder: `oklch(0.25 0.03 ${h})`,
  };
}

// ── Theme presets ───────────────────────────────────────────────────

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "oceano",
    name: "Océano",
    light: {
      background: "oklch(0.97 0.01 230)",
      foreground: "oklch(0.18 0.04 240)",
      card: "oklch(0.99 0.005 230)",
      primary: "oklch(0.55 0.2 240)",
      primaryForeground: "oklch(0.98 0.005 230)",
      muted: "oklch(0.93 0.02 230)",
      mutedForeground: "oklch(0.5 0.04 240)",
      border: "oklch(0.88 0.025 230)",
      input: "oklch(0.88 0.025 230)",
      ring: "oklch(0.6 0.18 220)",
      sidebar: "oklch(0.95 0.015 230)",
      sidebarBorder: "oklch(0.88 0.025 230)",
    },
    dark: {
      background: "oklch(0.14 0.03 240)",
      foreground: "oklch(0.93 0.01 230)",
      card: "oklch(0.17 0.035 240)",
      primary: "oklch(0.7 0.17 220)",
      primaryForeground: "oklch(0.13 0.03 240)",
      muted: "oklch(0.22 0.03 240)",
      mutedForeground: "oklch(0.65 0.04 230)",
      border: "oklch(0.28 0.03 240)",
      input: "oklch(0.25 0.03 240)",
      ring: "oklch(0.6 0.15 220)",
      sidebar: "oklch(0.12 0.035 240)",
      sidebarBorder: "oklch(0.25 0.03 240)",
    },
  },
  {
    id: "bosque",
    name: "Bosque",
    light: {
      background: "oklch(0.97 0.012 150)",
      foreground: "oklch(0.18 0.04 150)",
      card: "oklch(0.99 0.006 150)",
      primary: "oklch(0.52 0.17 155)",
      primaryForeground: "oklch(0.98 0.005 150)",
      muted: "oklch(0.93 0.02 150)",
      mutedForeground: "oklch(0.5 0.04 150)",
      border: "oklch(0.88 0.025 150)",
      input: "oklch(0.88 0.025 150)",
      ring: "oklch(0.58 0.15 140)",
      sidebar: "oklch(0.95 0.015 150)",
      sidebarBorder: "oklch(0.88 0.025 150)",
    },
    dark: {
      background: "oklch(0.14 0.025 150)",
      foreground: "oklch(0.93 0.01 150)",
      card: "oklch(0.17 0.03 150)",
      primary: "oklch(0.65 0.17 155)",
      primaryForeground: "oklch(0.13 0.025 150)",
      muted: "oklch(0.22 0.025 150)",
      mutedForeground: "oklch(0.65 0.04 150)",
      border: "oklch(0.28 0.025 150)",
      input: "oklch(0.25 0.025 150)",
      ring: "oklch(0.58 0.15 140)",
      sidebar: "oklch(0.12 0.03 150)",
      sidebarBorder: "oklch(0.25 0.025 150)",
    },
  },
  {
    id: "lavanda",
    name: "Lavanda",
    light: {
      background: "oklch(0.97 0.012 290)",
      foreground: "oklch(0.18 0.035 290)",
      card: "oklch(0.99 0.006 290)",
      primary: "oklch(0.55 0.2 290)",
      primaryForeground: "oklch(0.98 0.005 290)",
      muted: "oklch(0.93 0.02 290)",
      mutedForeground: "oklch(0.5 0.04 290)",
      border: "oklch(0.88 0.025 290)",
      input: "oklch(0.88 0.025 290)",
      ring: "oklch(0.6 0.18 310)",
      sidebar: "oklch(0.95 0.015 290)",
      sidebarBorder: "oklch(0.88 0.025 290)",
    },
    dark: {
      background: "oklch(0.14 0.03 290)",
      foreground: "oklch(0.93 0.01 290)",
      card: "oklch(0.17 0.035 290)",
      primary: "oklch(0.7 0.17 290)",
      primaryForeground: "oklch(0.13 0.03 290)",
      muted: "oklch(0.22 0.03 290)",
      mutedForeground: "oklch(0.65 0.04 290)",
      border: "oklch(0.28 0.03 290)",
      input: "oklch(0.25 0.03 290)",
      ring: "oklch(0.6 0.15 310)",
      sidebar: "oklch(0.12 0.035 290)",
      sidebarBorder: "oklch(0.25 0.03 290)",
    },
  },
  {
    id: "atardecer",
    name: "Atardecer",
    light: {
      background: "oklch(0.97 0.012 55)",
      foreground: "oklch(0.2 0.04 40)",
      card: "oklch(0.99 0.008 55)",
      primary: "oklch(0.6 0.22 30)",
      primaryForeground: "oklch(0.98 0.005 30)",
      muted: "oklch(0.93 0.02 50)",
      mutedForeground: "oklch(0.5 0.04 40)",
      border: "oklch(0.88 0.025 50)",
      input: "oklch(0.88 0.025 50)",
      ring: "oklch(0.65 0.2 45)",
      sidebar: "oklch(0.95 0.015 55)",
      sidebarBorder: "oklch(0.88 0.025 50)",
    },
    dark: {
      background: "oklch(0.14 0.025 30)",
      foreground: "oklch(0.93 0.01 50)",
      card: "oklch(0.17 0.03 30)",
      primary: "oklch(0.7 0.2 30)",
      primaryForeground: "oklch(0.13 0.025 30)",
      muted: "oklch(0.22 0.025 30)",
      mutedForeground: "oklch(0.65 0.04 40)",
      border: "oklch(0.28 0.025 30)",
      input: "oklch(0.25 0.025 30)",
      ring: "oklch(0.6 0.18 45)",
      sidebar: "oklch(0.12 0.03 30)",
      sidebarBorder: "oklch(0.25 0.025 30)",
    },
  },
  {
    id: "medianoche",
    name: "Medianoche",
    light: {
      background: "oklch(0.96 0.015 260)",
      foreground: "oklch(0.18 0.04 260)",
      card: "oklch(0.98 0.008 260)",
      primary: "oklch(0.5 0.22 260)",
      primaryForeground: "oklch(0.97 0.005 260)",
      muted: "oklch(0.92 0.02 260)",
      mutedForeground: "oklch(0.5 0.04 260)",
      border: "oklch(0.87 0.025 260)",
      input: "oklch(0.87 0.025 260)",
      ring: "oklch(0.55 0.2 280)",
      sidebar: "oklch(0.94 0.018 260)",
      sidebarBorder: "oklch(0.87 0.025 260)",
    },
    dark: {
      background: "oklch(0.11 0.04 260)",
      foreground: "oklch(0.92 0.01 260)",
      card: "oklch(0.14 0.045 260)",
      primary: "oklch(0.65 0.2 260)",
      primaryForeground: "oklch(0.11 0.04 260)",
      muted: "oklch(0.2 0.035 260)",
      mutedForeground: "oklch(0.63 0.04 260)",
      border: "oklch(0.26 0.035 260)",
      input: "oklch(0.23 0.035 260)",
      ring: "oklch(0.55 0.18 280)",
      sidebar: "oklch(0.09 0.045 260)",
      sidebarBorder: "oklch(0.23 0.035 260)",
    },
  },
  {
    id: "arena",
    name: "Arena",
    light: {
      background: "oklch(0.96 0.02 80)",
      foreground: "oklch(0.22 0.035 60)",
      card: "oklch(0.98 0.015 80)",
      primary: "oklch(0.58 0.14 60)",
      primaryForeground: "oklch(0.97 0.01 80)",
      muted: "oklch(0.92 0.025 80)",
      mutedForeground: "oklch(0.5 0.04 65)",
      border: "oklch(0.87 0.03 80)",
      input: "oklch(0.87 0.03 80)",
      ring: "oklch(0.62 0.13 50)",
      sidebar: "oklch(0.94 0.022 80)",
      sidebarBorder: "oklch(0.87 0.03 80)",
    },
    dark: {
      background: "oklch(0.16 0.02 60)",
      foreground: "oklch(0.92 0.015 80)",
      card: "oklch(0.19 0.025 60)",
      primary: "oklch(0.7 0.14 60)",
      primaryForeground: "oklch(0.15 0.02 60)",
      muted: "oklch(0.24 0.02 60)",
      mutedForeground: "oklch(0.65 0.035 70)",
      border: "oklch(0.3 0.02 60)",
      input: "oklch(0.27 0.02 60)",
      ring: "oklch(0.62 0.13 50)",
      sidebar: "oklch(0.14 0.025 60)",
      sidebarBorder: "oklch(0.27 0.02 60)",
    },
  },
  {
    id: "cereza",
    name: "Cereza",
    light: {
      background: "oklch(0.97 0.015 335)",
      foreground: "oklch(0.2 0.035 330)",
      card: "oklch(0.99 0.008 335)",
      primary: "oklch(0.6 0.22 335)",
      primaryForeground: "oklch(0.98 0.005 335)",
      muted: "oklch(0.93 0.022 335)",
      mutedForeground: "oklch(0.5 0.04 330)",
      border: "oklch(0.88 0.025 335)",
      input: "oklch(0.88 0.025 335)",
      ring: "oklch(0.65 0.2 345)",
      sidebar: "oklch(0.95 0.018 335)",
      sidebarBorder: "oklch(0.88 0.025 335)",
    },
    dark: {
      background: "oklch(0.14 0.03 330)",
      foreground: "oklch(0.93 0.01 335)",
      card: "oklch(0.17 0.035 330)",
      primary: "oklch(0.7 0.2 335)",
      primaryForeground: "oklch(0.13 0.03 330)",
      muted: "oklch(0.22 0.03 330)",
      mutedForeground: "oklch(0.65 0.04 335)",
      border: "oklch(0.28 0.03 330)",
      input: "oklch(0.25 0.03 330)",
      ring: "oklch(0.65 0.18 345)",
      sidebar: "oklch(0.12 0.035 330)",
      sidebarBorder: "oklch(0.25 0.03 330)",
    },
  },
  {
    id: "grafito",
    name: "Grafito",
    // Superficies monocromas + acento rose en primary/ring: lo sobrio de
    // grafito sin el botón primario deslavado. El chroma referencia
    // --accent-chroma (la perilla global del sistema).
    light: {
      background: "oklch(0.97 0.003 260)",
      foreground: "oklch(0.2 0.01 260)",
      card: "oklch(0.99 0.002 260)",
      primary: "oklch(0.58 var(--accent-chroma) 18)",
      primaryForeground: "oklch(0.98 0.005 18)",
      muted: "oklch(0.93 0.005 260)",
      mutedForeground: "oklch(0.5 0.015 260)",
      border: "oklch(0.88 0.005 260)",
      input: "oklch(0.88 0.005 260)",
      ring: "oklch(0.58 var(--accent-chroma) 18)",
      sidebar: "oklch(0.95 0.004 260)",
      sidebarBorder: "oklch(0.88 0.005 260)",
    },
    dark: {
      background: "oklch(0.14 0.008 260)",
      foreground: "oklch(0.88 0.005 260)",
      card: "oklch(0.17 0.01 260)",
      primary: "oklch(0.68 var(--accent-chroma) 18)",
      primaryForeground: "oklch(0.98 0.005 18)",
      muted: "oklch(0.22 0.008 260)",
      mutedForeground: "oklch(0.6 0.01 260)",
      border: "oklch(0.28 0.008 260)",
      input: "oklch(0.25 0.008 260)",
      ring: "oklch(0.68 var(--accent-chroma) 18)",
      sidebar: "oklch(0.12 0.01 260)",
      sidebarBorder: "oklch(0.25 0.008 260)",
    },
  },
];

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

function extractHue(oklchStr: string): number {
  // Soporta chroma numérico ("oklch(0.7 0.17 220)") y chroma como var()
  // ("oklch(0.68 var(--accent-chroma) 18)"): el hue es el último número
  // antes del paréntesis de cierre (los primary no llevan alpha).
  const match =
    oklchStr.match(/oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s*\)/) ||
    oklchStr.match(/([\d.]+)\s*\)\s*$/);
  return match ? parseFloat(match[1]) : 0;
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

  // Derive chart colors from theme hue
  const hue = extractHue(p.primary);
  root.style.setProperty("--chart-1", `oklch(0.81 0.12 ${hue})`);
  root.style.setProperty("--chart-2", `oklch(0.65 0.2 ${hue})`);
  root.style.setProperty("--chart-3", `oklch(0.55 0.22 ${hue})`);
  root.style.setProperty("--chart-4", `oklch(0.48 0.2 ${hue + 15})`);
  root.style.setProperty("--chart-5", `oklch(0.42 0.17 ${hue - 15})`);
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
