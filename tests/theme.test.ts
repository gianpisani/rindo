import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ACCENT_PRESETS,
  NEUTRAL_SURFACES,
  RINDO_ACCENT,
  generatedAccent,
  oklchContrast,
  resolvePalette,
  tintedSurfaces,
  type ThemeMode,
} from '../src/lib/theme.ts';

const MODES: ThemeMode[] = ['light', 'dark'];
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

function cssBlock(selector: string) {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf('}', start));
}

function cssVar(block: string, name: string) {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(block)?.[1].trim();
}

const CSS_NAMES: Record<string, string> = {
  background: 'background',
  foreground: 'foreground',
  card: 'card',
  muted: 'muted',
  mutedForeground: 'muted-foreground',
  border: 'border',
  input: 'input',
  sidebar: 'sidebar',
  sidebarAccent: 'sidebar-accent',
  sidebarBorder: 'sidebar-border',
};

test('neutral surfaces and the Rindo accent match index.css', () => {
  const blocks: Record<ThemeMode, string> = { light: cssBlock(':root'), dark: cssBlock('.dark') };
  for (const mode of MODES) {
    for (const [key, name] of Object.entries(CSS_NAMES)) {
      assert.equal(NEUTRAL_SURFACES[mode][key as keyof typeof CSS_NAMES & keyof typeof NEUTRAL_SURFACES.light], cssVar(blocks[mode], name), `${mode} --${name}`);
    }
    assert.equal(RINDO_ACCENT[mode].primary, cssVar(blocks[mode], 'primary'), `${mode} --primary`);
  }
});

test('any accent combines with the neutral black', () => {
  const palette = resolvePalette('bosque', { surface: 'neutral' }, 'dark');
  assert.equal(palette.background, NEUTRAL_SURFACES.dark.background);
  assert.equal(palette.primary, generatedAccent(150, 'dark').primary);
});

test('Rindo accent can be tinted too', () => {
  const palette = resolvePalette(null, { surface: 'tinted' }, 'dark');
  assert.equal(palette.primary, RINDO_ACCENT.dark.primary);
  assert.equal(palette.background, tintedSurfaces(RINDO_ACCENT.dark.hue, 'dark').background);
});

test('presets stay tinted by default', () => {
  assert.equal(resolvePalette('oceano', {}, 'light').background, tintedSurfaces(255, 'light').background);
});

test('text keeps 4.5:1 on every surface', () => {
  const hues = [RINDO_ACCENT.dark.hue, ...ACCENT_PRESETS.map((p) => p.hue), 0, 90, 180, 270];
  for (const mode of MODES) {
    const surfaces = [NEUTRAL_SURFACES[mode], ...hues.map((h) => tintedSurfaces(h, mode))];
    for (const s of surfaces) {
      for (const bg of [s.background, s.card, s.sidebar]) {
        assert.ok(oklchContrast(s.foreground, bg) >= 4.5, `${mode} foreground on ${bg}`);
        assert.ok(oklchContrast(s.mutedForeground, bg) >= 4.5, `${mode} muted on ${bg}`);
      }
    }
  }
});

test('text on any generated accent keeps 4.5:1', () => {
  for (const mode of MODES) {
    for (let hue = 0; hue < 360; hue += 5) {
      const accent = generatedAccent(hue, mode);
      assert.ok(oklchContrast(accent.primaryForeground, accent.primary) >= 4.5, `${mode} hue ${hue}`);
    }
  }
});
