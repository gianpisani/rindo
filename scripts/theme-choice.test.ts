import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INITIAL_THEME_CHOICE,
  sameThemeChoice,
  serializeThemeChoice,
  themeChoiceFromProfile,
  themeChoiceSettings,
} from '../src/lib/theme-choice.ts';

test('the default choice stores nothing', () => {
  assert.equal(serializeThemeChoice(INITIAL_THEME_CHOICE), null);
  assert.deepEqual(themeChoiceSettings(INITIAL_THEME_CHOICE), {});
});

test('hue is kept only for the custom palette', () => {
  assert.deepEqual(themeChoiceSettings({ ...INITIAL_THEME_CHOICE, themeId: 'bosque', surface: 'tinted', hue: 10 }), {});
  assert.deepEqual(themeChoiceSettings({ ...INITIAL_THEME_CHOICE, themeId: 'custom', surface: 'tinted', hue: 10 }), { hue: 10 });
});

test('font and radius survive any palette, including Rindo', () => {
  const choice = { ...INITIAL_THEME_CHOICE, font: 'inter', radius: 0.25 };
  assert.deepEqual(themeChoiceSettings(choice), { font: 'inter', radius: 0.25 });
});

test('round-trips through the profile columns', () => {
  const choice = { themeId: 'custom', surface: 'tinted' as const, hue: 120, font: 'sora', radius: 1 };
  assert.deepEqual(themeChoiceFromProfile(choice.themeId, serializeThemeChoice(choice)), choice);
});

test('retired presets map to their replacement', () => {
  assert.equal(themeChoiceFromProfile('medianoche', null).themeId, 'oceano');
  assert.equal(themeChoiceFromProfile('unknown', null).themeId, null);
});

test('sameThemeChoice ignores hue unless the palette is custom', () => {
  const base = { ...INITIAL_THEME_CHOICE, themeId: 'arena', surface: 'tinted' as const };
  assert.equal(sameThemeChoice(base, { ...base, hue: 12 }), true);
  assert.equal(sameThemeChoice({ ...base, themeId: 'custom' }, { ...base, themeId: 'custom', hue: 12 }), false);
  assert.equal(sameThemeChoice(base, { ...base, font: 'inter' }), false);
});

test('surface is stored only when it differs from the accent default', () => {
  assert.deepEqual(themeChoiceSettings({ ...INITIAL_THEME_CHOICE, themeId: 'bosque', surface: 'tinted' }), {});
  assert.deepEqual(themeChoiceSettings({ ...INITIAL_THEME_CHOICE, themeId: 'bosque', surface: 'neutral' }), { surface: 'neutral' });
  assert.deepEqual(themeChoiceSettings({ ...INITIAL_THEME_CHOICE, surface: 'tinted' }), { surface: 'tinted' });
});

test('existing profiles keep their look', () => {
  assert.equal(themeChoiceFromProfile('bosque', null).surface, 'tinted');
  assert.equal(themeChoiceFromProfile(null, null).surface, 'neutral');
  assert.equal(themeChoiceFromProfile('oceano', '{"surface":"neutral"}').surface, 'neutral');
});
