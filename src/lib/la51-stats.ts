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
 * `ck` 与 config/site.yaml 的 analytics.la51.ck 一致（挂件 URL 用同一个 ID）。
 */

export const LA51_WIDGET_URL = 'https://v6-widget.51.la/v6/3REPy7id8yIlqsbo/quote.js';

/** 脚本内的数据下标 → 页面上的 data-stat 键（跳过下标 0「最近活跃访客」）。 */
export const LA51_FIELDS: Record<number, string> = {
  1: 'todayUv',
  2: 'todayPv',
  3: 'yesterdayUv',
  4: 'yesterdayPv',
  5: 'monthPv',
  6: 'totalPv',
};

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
 * 填充页面上所有 `[data-stat]` 占位元素。
 *
 * 同一页可能有多处（关于页的统计卡、统计页的资讯区），因此这里一次性全填。
 * 单例：并发调用只发一次请求。
 */
let pending: Promise<Record<string, number>> | null = null;

export function loadLa51Stats(): Promise<Record<string, number>> {
  if (!pending) {
    pending = fetch(LA51_WIDGET_URL)
      .then((res) => (res.ok ? res.text() : ''))
      .then((text) => (text ? parseLa51Widget(text) : {}))
      .catch(() => ({}));
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

/** 取数并填充；没有 `[data-stat]` 占位时直接返回。 */
export function initLa51Stats(): void {
  if (!document.querySelector('[data-stat]')) return;
  void loadLa51Stats().then((values) => {
    if (Object.keys(values).length > 0) paintLa51Stats(values);
  });
}
