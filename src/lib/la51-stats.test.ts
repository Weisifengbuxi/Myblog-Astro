/**
 * 51LA 统计读取的纯逻辑测试：解析挂件文本、localStorage 缓存兜底、时间与提示文案。
 *
 * 网络那一层（fetch quote.js）不做单测，浏览器里跑；这里只覆盖可注入的纯函数。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildLa51Note,
  formatLa51UpdatedAt,
  LA51_CACHE_KEY,
  LA51_CACHE_MAX_AGE_MS,
  type La51Storage,
  parseLa51Widget,
  readLa51Cache,
  writeLa51Cache,
} from './la51-stats';

/** 内存版 Storage：缓存逻辑只用到 getItem/setItem。 */
function memoryStore(): La51Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

describe('parseLa51Widget', () => {
  it('按 span 里的序号取数，不依赖出现顺序', () => {
    const text =
      '<p><span>6</span><span>1630</span></p><p><span>2</span><span>0</span></p>' +
      '<p><span>3</span><span>3</span></p><p><span>1</span><span>0</span></p>';
    assert.deepEqual(parseLa51Widget(text), { totalPv: 1630, todayPv: 0, yesterdayUv: 3, todayUv: 0 });
  });

  it('忽略未知序号与非数字值', () => {
    const text =
      '<span>0</span><span>5</span>' + // 最近活跃访客：不在 LA51_FIELDS 里
      '<span>9</span><span>7</span>' + // 未知序号
      '<span>4</span><span>abc</span>' + // 非数字
      '<span>6</span><span>1630</span>';
    assert.deepEqual(parseLa51Widget(text), { totalPv: 1630 });
  });

  it('没有数据段时返回空对象', () => {
    assert.deepEqual(parseLa51Widget('<html>no data</html>'), {});
  });
});

describe('la51 缓存兜底', () => {
  const values = { todayUv: 0, todayPv: 0, yesterdayUv: 3, yesterdayPv: 8, monthPv: 57, totalPv: 1630 };
  const now = new Date(2026, 9, 17, 1, 0).getTime();

  it('写进去能原样读出来，并标记为缓存', () => {
    const store = memoryStore();
    writeLa51Cache(store, values, now - 60_000);
    const cached = readLa51Cache(store, now);
    assert.ok(cached);
    assert.equal(cached.cached, true);
    assert.equal(cached.at, now - 60_000);
    assert.deepEqual(cached.values, values);
  });

  it('没有 store / 没有缓存 / 空对象都返回 null', () => {
    assert.equal(readLa51Cache(undefined, now), null);
    assert.equal(readLa51Cache(memoryStore(), now), null);
    writeLa51Cache(memoryStore(), {}, now);
    const empty = memoryStore();
    empty.setItem(LA51_CACHE_KEY, JSON.stringify({ values: {}, at: now }));
    assert.equal(readLa51Cache(empty, now), null);
  });

  it('坏掉的 JSON 或结构不合法都当作没缓存', () => {
    for (const raw of ['{', 'null', '[]', '{"values":{}}', '{"at":123}', '{"values":{"totalPv":"1630"},"at":123}']) {
      const store = memoryStore();
      store.setItem(LA51_CACHE_KEY, raw);
      assert.equal(readLa51Cache(store, now), null, `raw=${raw}`);
    }
  });

  it('过滤掉非数字字段，但保留其余有效值', () => {
    const store = memoryStore();
    store.setItem(LA51_CACHE_KEY, JSON.stringify({ values: { totalPv: 1630, junk: 'x' }, at: now - 1000 }));
    const cached = readLa51Cache(store, now);
    assert.deepEqual(cached?.values, { totalPv: 1630 });
  });

  it('超过 7 天的旧数据不再展示', () => {
    const store = memoryStore();
    writeLa51Cache(store, values, now - LA51_CACHE_MAX_AGE_MS - 1);
    assert.equal(readLa51Cache(store, now), null);
    writeLa51Cache(store, values, now - LA51_CACHE_MAX_AGE_MS + 1000);
    assert.ok(readLa51Cache(store, now));
  });
});

describe('兜底文案', () => {
  it('新数据不产生提示', () => {
    assert.equal(buildLa51Note({ values: { totalPv: 1 }, cached: false, at: Date.now() }), '');
    assert.equal(buildLa51Note({ values: {}, cached: false, at: null }), '');
  });

  it('缓存数据带出更新时间', () => {
    const at = new Date(2026, 9, 16, 23, 58).getTime();
    const note = buildLa51Note({ values: { totalPv: 1630 }, cached: true, at }, new Date(2026, 9, 17, 1, 0).getTime());
    assert.equal(note, '暂时取不到最新数据，显示的是 10-16 23:58 的数据');
  });

  it('跨年时带上年份', () => {
    const at = new Date(2025, 11, 31, 9, 5).getTime();
    assert.equal(formatLa51UpdatedAt(at, new Date(2026, 0, 1).getTime()), '2025-12-31 09:05');
    assert.equal(formatLa51UpdatedAt(at, new Date(2025, 11, 31, 10, 0).getTime()), '12-31 09:05');
  });
});
