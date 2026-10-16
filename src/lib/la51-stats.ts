/**
 * 51LA 访问数据读取。
 *
 * 真实数据**内嵌在数据挂件脚本（quote.js）的脚本文本里**，形如：
 *   <p><span>序号</span><span>数值</span></p>
 * 挂件渲染进 DOM 的那份永远是写死的占位符，所以只能 fetch 文本后用正则取，
 * 不能读 DOM。该地址带 `access-control-allow-origin: *`，前端可直接请求。
 *
 * 字段顺序取自脚本内的 b 数组：
 *   [["ol"],["t","u"],["t","p"],["y","u"],["y","p"],["m","p"],["tl","p"]]
 *   → 最近活跃访客 / 今日人数 / 今日访问 / 昨日人数 / 昨日访问 / 本月访问 / 总访问量
 *
 * 用的是**旧博客那个 51LA 应用**（3NaU22Pij8KxRC6w）：它累积了历史数据
 * （总访问量 1500+），而 Astro 站最初新建的应用只有几十次访问。
 * 站点埋点（config/site.yaml 的 analytics.la51.id/ck）已改为**同一个 ID**，
 * 这样新访问会继续累加到这份数据上；两者必须一致，否则统计与展示会脱节。
 *
 * **取不到数时的兜底**：51LA 的挂件域名 `v6-widget.51.la` 出过 TLS 证书过期
 * （2026-10-16 23:59 到期，浏览器直接以 ERR_CERT_DATE_INVALID 拒绝加载 quote.js），
 * 这类故障我们改不了 —— 那就别让卡片空着：每次成功取数都把结果连同时间戳写进
 * localStorage，取不到新数据时用上次的值填充，并在 `[data-stat-note]` 里标注
 * 数据时间，让访客知道看到的不是实时数字。
 */

export const LA51_WIDGET_URL = 'https://v6-widget.51.la/v6/3NaU22Pij8KxRC6w/quote.js';

/** 脚本内的数据下标 → 页面上的 data-stat 键（跳过下标 0「最近活跃访客」）。 */
export const LA51_FIELDS: Record<number, string> = {
  1: 'todayUv',
  2: 'todayPv',
  3: 'yesterdayUv',
  4: 'yesterdayPv',
  5: 'monthPv',
  6: 'totalPv',
};

/** localStorage 里缓存上一次成功结果的位置。 */
export const LA51_CACHE_KEY = 'la51-stats-cache';

/** 超过这个时长的旧数据不再展示（免得拿几周前的数字冒充当前）。 */
export const LA51_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** 只用到 getItem/setItem，便于测试注入假实现。 */
export interface La51Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface La51StatsResult {
  values: Record<string, number>;
  /** true 表示这份数字来自缓存（本次没取到新数据）。 */
  cached: boolean;
  /** 数据对应的时间戳（毫秒）；没有任何数据时为 null。 */
  at: number | null;
}

export function parseLa51Widget(text: string): Record<string, number> {
  const result: Record<string, number> = {};
  // 按 span 里的**序号**取值，不靠出现顺序递推 —— 序号才是权威。
  const pattern = /<span>(\d+)<\/span><span>(\d+)<\/span>/g;
  let match: RegExpExecArray | null = pattern.exec(text);
  while (match) {
    const key = LA51_FIELDS[Number.parseInt(match[1], 10)];
    const value = Number.parseInt(match[2], 10);
    if (key && Number.isFinite(value)) result[key] = value;
    match = pattern.exec(text);
  }
  return result;
}

/**
 * 读缓存。没有、坏掉、字段不合法或过期都返回 null（当作没缓存）。
 */
export function readLa51Cache(store: La51Storage | undefined, now = Date.now()): La51StatsResult | null {
  if (!store) return null;
  const raw = store.getItem(LA51_CACHE_KEY);
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const { values, at } = parsed as { values?: unknown; at?: unknown };
  if (!values || typeof values !== 'object' || typeof at !== 'number' || !Number.isFinite(at)) return null;

  const clean: Record<string, number> = {};
  for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) clean[key] = value;
  }
  if (Object.keys(clean).length === 0) return null;
  if (now - at > LA51_CACHE_MAX_AGE_MS) return null;

  return { values: clean, cached: true, at };
}

/** 写缓存。私密模式/配额满导致的异常直接吞掉 —— 缓存失败不该影响展示。 */
export function writeLa51Cache(store: La51Storage | undefined, values: Record<string, number>, at = Date.now()): void {
  if (!store || Object.keys(values).length === 0) return;
  try {
    store.setItem(LA51_CACHE_KEY, JSON.stringify({ values, at }));
  } catch {
    // 忽略
  }
}

/** `MM-DD HH:mm`；不是同一年的还带上年份。 */
export function formatLa51UpdatedAt(at: number, now = Date.now()): string {
  const date = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return date.getFullYear() === new Date(now).getFullYear() ? stamp : `${date.getFullYear()}-${stamp}`;
}

/** 展示旧数据时的提示文案；数据是刚取到的新数据则返回空串。 */
export function buildLa51Note(result: La51StatsResult, now = Date.now()): string {
  if (!result.cached || result.at === null) return '';
  return `暂时取不到最新数据，显示的是 ${formatLa51UpdatedAt(result.at, now)} 的数据`;
}

/**
 * 取数：拿到新数据就顺手缓存；拿不到就退回缓存，都没有才返回空。
 * 单例：并发调用只发一次请求。
 */
let pending: Promise<La51StatsResult> | null = null;

export function loadLa51Stats(): Promise<La51StatsResult> {
  if (!pending) {
    const store = typeof localStorage === 'undefined' ? undefined : localStorage;
    pending = fetch(LA51_WIDGET_URL)
      .then((res) => (res.ok ? res.text() : ''))
      .then((text) => (text ? parseLa51Widget(text) : {}))
      .catch(() => ({}))
      .then((values): La51StatsResult => {
        if (Object.keys(values).length > 0) {
          const at = Date.now();
          writeLa51Cache(store, values, at);
          return { values, cached: false, at };
        }
        return readLa51Cache(store) ?? { values: {}, cached: false, at: null };
      });
  }
  return pending;
}

export function paintLa51Stats(values: Record<string, number>): number {
  let painted = 0;
  for (const [key, value] of Object.entries(values)) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-stat="${key}"]`)) {
      el.textContent = value.toLocaleString('zh-CN');
      painted += 1;
    }
  }
  return painted;
}

/** 写（或清空）所有 `[data-stat-note]` 的兜底提示。 */
export function paintLa51Note(note: string): number {
  let painted = 0;
  for (const el of document.querySelectorAll<HTMLElement>('[data-stat-note]')) {
    el.textContent = note;
    el.hidden = note === '';
    painted += 1;
  }
  return painted;
}

/** 取数并填充；没有 `[data-stat]` 占位时直接返回。 */
export function initLa51Stats(): void {
  if (!document.querySelector('[data-stat]')) return;
  void loadLa51Stats().then((result) => {
    if (Object.keys(result.values).length === 0) return;
    paintLa51Stats(result.values);
    paintLa51Note(buildLa51Note(result));
  });
}
