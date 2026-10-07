import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLICK_EFFECT_KINDS,
  CLICK_SHOW_TEXT_DEFAULTS,
  isClickEffectKind,
  isMotionLevel,
  MOTION_DEFAULTS,
  normalizeClickShowTextConfig,
  normalizeMotionConfig,
} from './motion';

test('an absent section resolves to the lively defaults', () => {
  assert.deepEqual(normalizeMotionConfig(undefined), MOTION_DEFAULTS);
  assert.deepEqual(normalizeMotionConfig(null), MOTION_DEFAULTS);
  assert.deepEqual(normalizeMotionConfig({}), MOTION_DEFAULTS);
  assert.equal(MOTION_DEFAULTS.level, 'lively');
});

test('defaults are applied per field', () => {
  const resolved = normalizeMotionConfig({ level: 'subtle' });
  assert.equal(resolved.level, 'subtle');
  assert.equal(resolved.heroPetals, true);
  assert.equal(resolved.clickBurst, true);
});

test('explicit false disables the sakura effects', () => {
  const resolved = normalizeMotionConfig({ heroPetals: false, clickBurst: false });
  assert.equal(resolved.heroPetals, false);
  assert.equal(resolved.clickBurst, false);
});

test('unknown levels and wrongly typed flags fall back to the default', () => {
  const resolved = normalizeMotionConfig({ level: 'wild', heroPetals: 'yes', clickBurst: 1 } as never);
  assert.deepEqual(resolved, MOTION_DEFAULTS);
});

test('isMotionLevel accepts exactly the three levels', () => {
  for (const level of ['lively', 'subtle', 'reduced']) assert.equal(isMotionLevel(level), true);
  for (const value of ['off', '', null, undefined, 1]) assert.equal(isMotionLevel(value), false);
});

// ---------------------------------------------------------------------------
// Click effect kind + clickShowText (the 社会主义核心价值观 word burst)
// ---------------------------------------------------------------------------

test('the click effect defaults to the word burst', () => {
  assert.equal(MOTION_DEFAULTS.clickEffect, 'text');
  assert.equal(normalizeMotionConfig({}).clickEffect, 'text');
});

test('clickEffect accepts both kinds and rejects anything else', () => {
  for (const kind of CLICK_EFFECT_KINDS) {
    assert.equal(isClickEffectKind(kind), true);
    assert.equal(normalizeMotionConfig({ clickEffect: kind }).clickEffect, kind);
  }
  for (const value of ['words', 'sakura', '', null, undefined, 3]) {
    assert.equal(isClickEffectKind(value), false);
  }
  assert.equal(normalizeMotionConfig({ clickEffect: 'sakura' } as never).clickEffect, 'text');
});

test('clickShowText falls back to the original blog font size', () => {
  assert.equal(CLICK_SHOW_TEXT_DEFAULTS.fontSize, '20px');
  assert.equal(normalizeClickShowTextConfig(undefined).fontSize, '20px');
  assert.equal(normalizeClickShowTextConfig({ fontSize: '   ' }).fontSize, '20px');
  assert.equal(normalizeClickShowTextConfig({ fontSize: '2rem' }).fontSize, '2rem');
});

test('an empty word pool is preserved so the effect can be disabled by config', () => {
  // The runtime checks `text.length`; normalization must not invent words.
  assert.deepEqual(normalizeClickShowTextConfig({}).text, []);
  assert.deepEqual(normalizeClickShowTextConfig({ text: [] }).text, []);
});

test('non-string and blank entries are dropped from the pools', () => {
  const resolved = normalizeClickShowTextConfig({
    text: ['富强', '', '   ', 42, null, '民主'],
    colors: ['#fff', '', 7],
  } as never);
  assert.deepEqual(resolved.text, ['富强', '民主']);
  assert.deepEqual(resolved.colors, ['#fff']);
});

test('an empty colour pool means "generate a random colour per click"', () => {
  assert.deepEqual(CLICK_SHOW_TEXT_DEFAULTS.colors, []);
  assert.deepEqual(normalizeClickShowTextConfig({}).colors, []);
});
