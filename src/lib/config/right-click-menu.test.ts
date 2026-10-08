import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeRightClickMenuConfig, RIGHT_CLICK_MENU_DEFAULTS } from './right-click-menu';

test('the menu is opt-in', () => {
  // Replacing the browser's native context menu should never happen by accident.
  assert.equal(RIGHT_CLICK_MENU_DEFAULTS.enabled, false);
  assert.equal(normalizeRightClickMenuConfig(undefined).enabled, false);
  assert.equal(normalizeRightClickMenuConfig(null).enabled, false);
  assert.equal(normalizeRightClickMenuConfig({}).enabled, false);
});

test('only an explicit true enables it', () => {
  assert.equal(normalizeRightClickMenuConfig({ enabled: true }).enabled, true);
  for (const bad of ['true', 1, 'yes', {}, []]) {
    assert.equal(normalizeRightClickMenuConfig({ enabled: bad } as never).enabled, false, `enabled=${JSON.stringify(bad)}`);
  }
});
