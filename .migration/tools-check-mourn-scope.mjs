import path from 'node:path';
import { chromium } from 'playwright';

const BASE = 'http://localhost:4322';
const OUT = 'D:\\myBlog-astro\\.migration\\_shots';
// 用 12-13（国家公祭日，在 mourn.days 里）伪造时钟，从外部走真实日期判断分支
const MOURN_DAY = new Date(2026, 11, 13, 12, 0, 0);
const NORMAL_DAY = new Date(2026, 9, 6, 12, 0, 0);

const browser = await chromium.launch({ channel: 'chrome' });

async function probe(fakeDate, url, label) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(`{
    const fixed = ${fakeDate.getTime()};
    const RealDate = Date;
    class FakeDate extends RealDate {
      constructor(...args) { if (args.length === 0) { super(fixed); } else { super(...args); } }
      static now() { return fixed; }
    }
    window.Date = FakeDate;
  }`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  const state = await page.evaluate(() => ({
    path: location.pathname,
    dataMourn: document.documentElement.dataset.mourn ?? null,
    filter: getComputedStyle(document.documentElement).filter,
  }));
  console.log(`${label.padEnd(34)} ${state.path.padEnd(24)} data-mourn=${String(state.dataMourn).padEnd(6)} filter=${state.filter}`);
  await page.close();
  return state;
}

console.log('=== 纪念日（时钟拨到 2026-12-13）===');
const a = await probe(MOURN_DAY, `${BASE}/`, '首页');
const b = await probe(MOURN_DAY, `${BASE}/post/3be0a65`, '文章页');
const c = await probe(MOURN_DAY, `${BASE}/about`, '关于页');
const d = await probe(MOURN_DAY, `${BASE}/categories/note`, '分类页');

console.log('\n=== 普通日（时钟拨到 2026-10-06）===');
const e = await probe(NORMAL_DAY, `${BASE}/`, '首页');
const f = await probe(NORMAL_DAY, `${BASE}/post/3be0a65`, '文章页');

const pass = [
  ['纪念日首页整页变灰', a.dataMourn === 'cover' && /grayscale/.test(a.filter)],
  ['纪念日文章页恢复彩色', b.dataMourn === null && b.filter === 'none'],
  ['纪念日关于页恢复彩色', c.dataMourn === null && c.filter === 'none'],
  ['纪念日分类页恢复彩色', d.dataMourn === null && d.filter === 'none'],
  ['普通日首页不变灰', e.dataMourn === null && e.filter === 'none'],
  ['普通日文章页不变灰', f.dataMourn === null && f.filter === 'none'],
];
console.log('');
for (const [label, ok] of pass) console.log(`${ok ? '✓' : '✗'} ${label}`);
await browser.close();
process.exit(pass.every(([, ok]) => ok) ? 0 : 1);
