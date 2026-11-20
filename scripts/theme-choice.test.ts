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
  assert.deepEqual(themeChoiceSettings({ ...INITIAL_THEME_CHOICE, themeId: 'bosque', hue: 10 }), {});
  assert.deepEqual(themeChoiceSettings({ ...INITIAL_THEME_CHOICE, themeId: 'custom', hue: 10 }), { hue: 10 });
});

test('font and radius survive any palette, including Rindo', () => {
  const choice = { themeId: null, hue: 240, font: 'inter', radius: 0.25 };
  assert.deepEqual(themeChoiceSettings(choice), { font: 'inter', radius: 0.25 });
});

test('round-trips through the profile columns', () => {
  const choice = { themeId: 'custom', hue: 120, font: 'sora', radius: 1 };
  assert.deepEqual(themeChoiceFromProfile(choice.themeId, serializeThemeChoice(choice)), choice);
});

test('retired presets map to their replacement', () => {
  assert.equal(themeChoiceFromProfile('medianoche', null).themeId, 'oceano');
  assert.equal(themeChoiceFromProfile('unknown', null).themeId, null);
});

test('sameThemeChoice ignores hue unless the palette is custom', () => {
  const base = { ...INITIAL_THEME_CHOICE, themeId: 'arena' };
  assert.equal(sameThemeChoice(base, { ...base, hue: 12 }), true);
  assert.equal(sameThemeChoice({ ...base, themeId: 'custom' }, { ...base, themeId: 'custom', hue: 12 }), false);
  assert.equal(sameThemeChoice(base, { ...base, font: 'inter' }), false);
});
