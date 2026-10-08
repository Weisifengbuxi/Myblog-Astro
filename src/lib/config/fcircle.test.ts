import assert from 'node:assert/strict';
import test from 'node:test';
import { FCIRCLE_DEFAULTS, normalizeFcircleConfig, resolveFcircleNavigation } from './fcircle';
import type { RouterItem } from './types';

const NAV: RouterItem[] = [
  { name: '首页', path: '/' },
  {
    name: '友链',
    path: '/friends',
    children: [
      { name: '朋友圈', path: '/fcircle' },
      { name: '友链申请', path: '/link' },
    ],
  },
];

test('an absent section is disabled by default', () => {
  assert.equal(FCIRCLE_DEFAULTS.enabled, false);
  assert.equal(normalizeFcircleConfig(undefined).enabled, false);
  assert.equal(normalizeFcircleConfig({}).enabled, false);
  // Only an explicit `true` switches it on.
  assert.equal(normalizeFcircleConfig({ enabled: 'yes' } as never).enabled, false);
  assert.equal(normalizeFcircleConfig({ enabled: true }).enabled, true);
});

test('defaults are applied per field and blank strings do not win', () => {
  const r = normalizeFcircleConfig({ enabled: true, title: '  ', description: '', topTips: '', pageSize: 0 });
  assert.equal(r.title, FCIRCLE_DEFAULTS.title);
  assert.equal(r.description, FCIRCLE_DEFAULTS.description);
  assert.equal(r.topTips, FCIRCLE_DEFAULTS.topTips);
  assert.equal(r.pageSize, FCIRCLE_DEFAULTS.pageSize);
});

test('a positive pageSize is honoured, junk falls back', () => {
  assert.equal(normalizeFcircleConfig({ pageSize: 10 }).pageSize, 10);
  assert.equal(normalizeFcircleConfig({ pageSize: 12.7 }).pageSize, 12);
  assert.equal(normalizeFcircleConfig({ pageSize: -1 }).pageSize, FCIRCLE_DEFAULTS.pageSize);
  assert.equal(normalizeFcircleConfig({ pageSize: 'x' } as never).pageSize, FCIRCLE_DEFAULTS.pageSize);
});

test('the nav entry is kept when enabled', () => {
  const items = resolveFcircleNavigation(NAV, { ...FCIRCLE_DEFAULTS, enabled: true });
  const children = items[1].children ?? [];
  assert.deepEqual(
    children.map((c) => c.path),
    ['/fcircle', '/link'],
  );
});

test('the nav entry is removed when disabled, without disturbing siblings', () => {
  const items = resolveFcircleNavigation(NAV, FCIRCLE_DEFAULTS);
  assert.equal(items[0].path, '/');
  const children = items[1].children ?? [];
  // /fcircle is gone, /link survives
  assert.deepEqual(
    children.map((c) => c.path),
    ['/link'],
  );
});

test('a group left with no children after removal collapses away', () => {
  const items = resolveFcircleNavigation(
    [{ name: '友链', children: [{ name: '朋友圈', path: '/fcircle' }] }],
    FCIRCLE_DEFAULTS,
  );
  assert.deepEqual(items, []);
});

test('a trailing slash on the path still matches', () => {
  const items = resolveFcircleNavigation([{ name: '朋友圈', path: '/fcircle/' }], FCIRCLE_DEFAULTS);
  assert.deepEqual(items, []);
});
