#!/usr/bin/env node
/**
 * 单元验证纪念日变灰的日期判断逻辑。
 *
 * 直接复用 BootScripts 里那段脚本的算法（本地时间 → 'M-D' → 比对配置），
 * 用假时钟覆盖若干日期，确认命中/未命中都正确。
 */
import assert from 'node:assert/strict';

const DAYS = ['4-5', '5-12', '7-7', '9-18', '12-13'];

/** 与 BootScripts.astro 内联脚本等价的判断 */
function isMournDay(now, days) {
  const today = now.getMonth() + 1 + '-' + now.getDate();
  return days.indexOf(today) !== -1;
}

const at = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);

const cases = [
  // [日期, 是否应命中, 说明]
  [at(2026, 4, 5), true, '清明 4-5'],
  [at(2026, 5, 12), true, '汶川地震 5-12'],
  [at(2026, 7, 7), true, '七七事变 7-7'],
  [at(2026, 9, 18), true, '九一八 9-18'],
  [at(2026, 12, 13), true, '国家公祭日 12-13'],
  [at(2026, 10, 6), false, '今天 10-6 不是纪念日'],
  [at(2026, 4, 6), false, '清明的后一天不应命中'],
  [at(2026, 12, 12), false, '公祭日的前一天不应命中'],
  [at(2026, 1, 1), false, '元旦不是纪念日'],
  // 跨年与闰年边界，确认没有 off-by-one
  [at(2026, 12, 31), false, '跨年前夜'],
  [at(2028, 2, 29), false, '闰日'],
];

let failed = 0;
for (const [date, expected, label] of cases) {
  const actual = isMournDay(date, DAYS);
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${label.padEnd(28)} ${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}  →  ${actual}`);
}

assert.equal(failed, 0, `${failed} 个用例未通过`);
console.log(`\n全部 ${cases.length} 个日期用例通过。`);
